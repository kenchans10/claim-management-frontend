import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  ClaimDetailsResponse,
  ClaimPageResponse,
  ClaimType,
  getClaimDetails,
  HttpValidationProblemDetails,
  listClaims,
  ListClaimsData,
  ProblemDetails,
  provideInformation,
  requestInformation,
  submitClaim,
  SubmitClaimRequest,
} from './generated';
import { client } from './generated/client.gen';

/** Normalises a claim type string from the API to the casing the app expects.
 *  Handles both 'MOTOR' / 'PROPERTY' (all-caps) and already-correct casing. */
function normalizeClaimType(raw: string | null | undefined): ClaimType {
  if (!raw) return 'Motor';
  const map: Record<string, ClaimType> = {
    motor: 'Motor',
    property: 'Property',
  };
  return map[raw.toLowerCase()] ?? (raw as ClaimType);
}

/** Problem details plus the claim's current ETag, which the API sends with a 409 so the page can retry against the latest version. */
export type ApiProblem = Partial<
  ProblemDetails & HttpValidationProblemDetails
> & {
  etag?: string;
};

const NETWORK_PROBLEM: ApiProblem = {
  status: 0,
  title: 'Service unreachable',
  detail:
    'The claims service could not be reached. Check your connection and try again.',
};

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response?: {
    headers: { get(name: string): string | null };
    status: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ClaimsApi {
  constructor() {
    client.setConfig({ baseUrl: '', httpClient: inject(HttpClient) });
  }

  async list(query: ListClaimsData['query']): Promise<ClaimPageResponse> {
    const result = await listClaims({ query });
    // The API wraps its response in { success, item: [...], message, timestamp }.
    // Unwrap and map to the ClaimPageResponse shape the UI expects.
    const envelope = result.data as unknown as { item: Record<string, unknown>[] };
    const rawItems = envelope?.item ?? [];
    const items = rawItems.map((item) => ({
      reference: item['claimNumber'] as string,
      type: normalizeClaimType(item['claimType'] as string),
      claimType: normalizeClaimType(item['claimType'] as string),
      status: item['status'] as string,
      claimantId: item['claimantMemberNumber'] as string,
      claimantName: item['claimantMemberNumber'] as string,
      assignedOfficer: null,
      submittedAt: item['createdAt'] as string,
      updatedAt: item['updatedAt'] as string,
    }));
    return {
      items: items as unknown as ClaimPageResponse['items'],
      page: 1,
      pageSize: items.length || 10,
      totalCount: items.length,
    };
  }

  async get(
    reference: string,
  ): Promise<{ claim: ClaimDetailsResponse; etag: string }> {
    const result = await getClaimDetails({ path: { reference } });
    // The API wraps its response in { success, item, message, timestamp }. Unwrap and map.
    const envelope = result.data as unknown as { item: Record<string, unknown> };
    const item = envelope?.item ?? (result.data as unknown as Record<string, unknown>);
    const claim = {
      ...item,
      reference: item['claimNumber'],
      type: normalizeClaimType(item['claimType'] as string),
      claimType: normalizeClaimType(item['claimType'] as string),
      status: item['status'],
      submittedAt: item['createdAt'],
      informationRequests: [],
      assignedOfficer: null,
      claimant: { fullName: item['fullName'], email: item['email'], phone: item['phone'] },
    } as unknown as ClaimDetailsResponse;
    return {
      claim,
      etag: result.response?.headers.get('ETag') ?? '',
    };
  }

  async submit(
    body: SubmitClaimRequest,
  ): Promise<{ claim: ClaimDetailsResponse; etag: string }> {
    const result = await submitClaim({ body });
    // The submit endpoint wraps its response in { success, item, message, timestamp }.
    // Unwrap item and map claimNumber -> reference so the rest of the app works uniformly.
    const raw = result.data as unknown as { item: Record<string, unknown> };
    const item = raw?.item ?? (result.data as unknown as Record<string, unknown>);
    const claim = {
      ...item,
      reference: item['claimNumber'],
    } as unknown as ClaimDetailsResponse;
    claim.claimType = normalizeClaimType(claim.claimType);
    return {
      claim,
      etag: result.response?.headers.get('ETag') ?? '',
    };
  }

  async requestInformation(
    reference: string,
    requestText: string,
    etag: string,
  ): Promise<{ claim: ClaimDetailsResponse; etag: string }> {
    return this.claimResult(
      await requestInformation({
        body: { requestText },
        headers: { 'If-Match': etag },
        path: { reference },
      }),
    );
  }

  async respond(
    reference: string,
    requestId: string,
    responseText: string,
    etag: string,
  ): Promise<{ claim: ClaimDetailsResponse; etag: string }> {
    return this.claimResult(
      await provideInformation({
        body: { responseText },
        headers: { 'If-Match': etag },
        path: { reference, requestId },
      }),
    );
  }

  /** The user-facing message for a failed request: the API's detail, or a generic fallback. */
  problemMessage(error: unknown, fallback = 'Something went wrong.'): string {
    return this.problem(error).detail ?? fallback;
  }

  problem(error: unknown): ApiProblem {
    // Network failures are turned into NETWORK_PROBLEM in data(), so anything else here is the API's problem body.
    if (error && typeof error === 'object') return error as ApiProblem;
    return { ...NETWORK_PROBLEM };
  }

  private claimResult(result: ApiResult<ClaimDetailsResponse>): {
    claim: ClaimDetailsResponse;
    etag: string;
  } {
    const claim = this.data(result);
    claim.type = normalizeClaimType(claim.type);
    claim.claimType = normalizeClaimType(claim.claimType);
    return {
      claim,
      etag: result.response?.headers.get('ETag') ?? '',
    };
  }

  private data<T>(result: ApiResult<T>): T {
    if (result.error !== undefined || result.data === undefined) {
      // Angular reports a request that never reached the server as status 0.
      if (!result.response || result.response.status === 0)
        throw { ...NETWORK_PROBLEM };
      const problem = this.problem(result.error);
      problem.status ??= result.response.status;
      problem.etag = result.response.headers.get('ETag') ?? undefined;
      throw problem;
    }
    return result.data;
  }
}

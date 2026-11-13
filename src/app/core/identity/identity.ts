import { computed, Injectable, signal } from '@angular/core';

export type UserRole = 'claimant' | 'officer';
export interface DemoUser {
  id: string;
  name: string;
  role: UserRole;
  identity: string;
  policyNumber: string;
  claimantMemberNumber: string;
}

interface ClaimantResponse {
  id: string;
  firstName?: string;
  lastName?: string;
  identity?: string;
  policyNumber?: string;
   claimantMemberNumber: string;
}

export const FALLBACK_USERS: DemoUser[] = [ /* your two demo users */ ];


export async function fetchClaimantUsers(signal?: AbortSignal): Promise<DemoUser[]> {
  const res = await fetch('/api/v1/claimants', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to load claimants: ${res.status} ${res.statusText}`);
  }

  const body: { success: boolean; item: Partial<ClaimantResponse>[]; message: string } =
    await res.json();

   return body.item.map((c) => ({
    id: c.id!,
    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
    role: 'claimant' as const,
    identity: c.identity ?? '',
    policyNumber: c.policyNumber ?? '',
    claimantMemberNumber: c.claimantMemberNumber ?? '',
  }));
}

/** Where each role lands and where its claims live, shared by navigation, links, and back links. */
export const ROLE_ROUTES: Record<
  UserRole,
  { home: string; claims: string; claimsLabel: string }
> = {
  claimant: {
    home: '/my-claims',
    claims: '/my-claims',
    claimsLabel: 'My claims',
  },
  officer: { home: '/dashboard', claims: '/my-claims', claimsLabel: 'Work queue' },
};

@Injectable({ providedIn: 'root' })
export class Identity {
  private readonly selectedId = signal(localStorage.getItem('claims-user'));
readonly users = signal<DemoUser[]>(FALLBACK_USERS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // A user is always selected: a missing or unknown stored id falls back to the first demo user, so every request carries an identity.
  readonly user = computed(
    () =>
        this.users().find((user) => user.id === this.selectedId()) ?? this.users()[0],
  );
  readonly role = computed(() => this.user()?.role ?? null);

  async loadUsers(signal?: AbortSignal): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const claimants = await fetchClaimantUsers(signal);
      if (claimants.length > 0) {
        this.users.set(claimants);
      }
    } catch (e) {
      // Keep the demo users so the app still works if the API is down.
      this.error.set(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string): void {
    this.selectedId.set(id);
    localStorage.setItem('claims-user', id);
  }
}

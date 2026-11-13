import { TextFieldModule } from '@angular/cdk/text-field';
import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';

import { ClaimsApi } from '../../core/api/claims-api';
import {
  ClaimDetailsResponse,
  InformationRequestResponse,
} from '../../core/api/generated';
import { Identity, ROLE_ROUTES } from '../../core/identity/identity';
import { Alert } from '../../shared/ui/alert';
import { confirmAction } from '../../shared/ui/confirm-dialog';
import { Icon, IconName } from '../../shared/ui/icon';
import { LoadingState } from '../../shared/ui/loading-state';
import { PageHeader } from '../../shared/ui/page-header';
import { SectionHeader } from '../../shared/ui/section-header';
import { StatePanel } from '../../shared/ui/state-panel';
import { requiredText } from '../../shared/validators';
import { CLAIM_TYPES } from './claim-type';
import { ClaimTypeIcon } from './claim-type-icon';
import { StatusBadge } from './status-badge';

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatInputModule,
    TextFieldModule,
    ReactiveFormsModule,
    StatePanel,
    Alert,
    ClaimTypeIcon,
    Icon,
    StatusBadge,
    LoadingState,
    MatDividerModule,
    PageHeader,
    SectionHeader,
  ],
  selector: 'app-claim-details',
  styles: `
    app-alert strong {
      margin-right: 0.25rem;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 21rem;
      align-items: start;
      gap: 1rem;
    }
    .detail-main,
    .detail-side {
      display: grid;
      align-content: start;
      gap: 1rem;
    }
    .detail-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      gap: 1.25rem 2rem;
    }
    .detail-list .full {
      grid-column: 1 / -1;
    }
    /* A label stacked above its value. */
    .detail-list div,
    .summary-card dl div,
    .decision-details div,
    .message {
      display: grid;
      align-content: start;
      gap: 0.25rem;
    }
    /* Every label above a value (details lists, decision details, and request messages) shares one style. */
    dt,
    .message-label {
      color: var(--muted);
      font-size: var(--text-xs);
      font-weight: 700;
    }
    dd {
      font-size: var(--text-sm);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .full-width {
      width: 100%;
    }
    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: var(--text-sm);
    }
    /* These cards space their children with a flex gap, so their section headers drop the usual bottom margin. */
    .summary-card app-section-header,
    .action-panel app-section-header {
      margin-bottom: 0.25rem;
    }
    /* The taller box meets the 24px minimum touch target. */
    .summary-card a {
      display: inline-flex;
      align-items: center;
      min-height: 1.75rem;
      color: var(--navy);
      overflow-wrap: anywhere;
    }
    .summary-card mat-divider {
      margin: 1.25rem 0;
    }
    .summary-card dl {
      display: grid;
      gap: 1rem;
    }
    .request-card {
      display: grid;
      gap: 0.75rem;
      padding: 1.25rem 0;
      border-top: 1px solid var(--line);
      font-size: var(--text-sm);
    }
    .request-card:first-of-type {
      padding-top: 0;
      border-top: 0;
    }
    .request-card:last-of-type {
      padding-bottom: 0;
    }
    .request-card > button {
      justify-self: end;
    }
    /* Messages in an information request: a labelled request, then a quoted reply or cancellation. Replies are content, not a status, so they stay neutral. */
    .message-body {
      color: var(--ink);
      font-size: var(--text-md);
      white-space: pre-line;
    }
    .response {
      padding: 0.875rem 1rem;
      border-left: 0.1875rem solid var(--line-strong);
      background: color-mix(in srgb, var(--chubb-grey) 10%, white);
    }
    .response .message-body {
      font-size: var(--text-sm);
    }
    .inline-action {
      display: flex;
      align-items: start;
      gap: 0.75rem;
    }
    .inline-action mat-form-field {
      flex: 1;
    }
    .inline-action button {
      margin-top: 0.25rem;
    }
    /* The left rule takes the decision's shared tone (settled success, rejected danger). */
    .decision-card {
      border-left: 0.25rem solid var(--tone-fg);
    }
    .decision-details {
      display: grid;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .decision-amount {
      color: var(--navy);
      font-size: var(--text-xl);
    }
    .decision-card p {
      font-size: var(--text-sm);
    }
    .decision-meta {
      display: block;
      margin-top: 0.5rem;
      color: var(--muted);
      font-size: var(--text-xs);
    }
    /* The decision is stacked, primary first, so both labels fit the narrow side column. */
    .decision-actions {
      display: grid;
      gap: 0.5rem;
    }
    /* Each entry draws the connector from its dot's centre to the next dot's centre, so the line always meets both dots and the last entry never trails a line. */
    .timeline {
      --timeline-gap: 1.25rem;
      --timeline-dot: 0.75rem;
      --timeline-dot-top: 0.375rem;
      display: grid;
      gap: var(--timeline-gap);
    }
    .timeline li {
      position: relative;
      display: grid;
      grid-template-columns: var(--timeline-dot) minmax(0, 1fr);
      gap: 1rem;
    }
    .timeline li:not(:last-child)::before {
      position: absolute;
      top: calc(var(--timeline-dot-top) + var(--timeline-dot) / 2);
      bottom: calc(
        -1 *
          (
            var(--timeline-gap) + var(--timeline-dot-top) +
              var(--timeline-dot) / 2
          )
      );
      left: calc(var(--timeline-dot) / 2 - 0.0625rem);
      width: 0.125rem;
      content: '';
      background: var(--navy-tint-strong);
    }
    .timeline-dot {
      position: relative;
      z-index: 1;
      width: var(--timeline-dot);
      height: var(--timeline-dot);
      margin-top: var(--timeline-dot-top);
      border-radius: 50%;
      background: var(--navy);
      box-shadow: 0 0 0 0.1875rem var(--navy-tint);
    }
    .timeline li div {
      display: grid;
      gap: 0.125rem;
    }
    .timeline li strong {
      font-size: var(--text-sm);
      font-weight: 700;
    }
    .timeline li span {
      color: var(--muted);
      font-size: var(--text-xs);
    }
    .action-panel {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }
    .action-panel h3 {
      margin-top: 0.25rem;
    }
    .action-panel mat-divider {
      margin: 0.75rem 0;
    }
    .read-only-note {
      display: grid;
      gap: 0.25rem;
      border-left: 0.25rem solid var(--chubb-grey);
      font-size: var(--text-sm);
    }
    @media (max-width: 52rem) {
      .detail-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      /* On one column, an officer reaches the actions straight after the claim details instead of below the whole history. */
      .detail-main,
      .detail-side {
        display: contents;
      }
      .incident-card {
        order: 1;
      }
      .action-panel,
      .read-only-note {
        order: 2;
      }
      .requests-card {
        order: 3;
      }
      .decision-card {
        order: 4;
      }
      .history-card {
        order: 5;
      }
      .summary-card {
        order: 6;
      }
    }
    @media (max-width: 36rem) {
      .detail-list {
        grid-template-columns: minmax(0, 1fr);
      }
      .inline-action {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `,
  template: `
    @if (loading()) {
      <app-loading-state message="Loading claim…" />
    } @else if (loadError()) {
      <app-state-panel
        [icon]="loadError()!.icon"
        [title]="loadError()!.title"
        [message]="loadError()!.message"
        [retryable]="loadError()!.retry"
        [backLink]="backLink"
        [backLabel]="backLabel"
        (retry)="load()"
      />
    } @else if (claim(); as item) {
      <app-page-header
        [heading]="item.reference"
        [eyebrow]="item.claimType + ' claim'"
        [description]="
          'Submitted ' + (item.submittedAt | date: 'd MMMM y, h:mm a')
        "
        [backLink]="backLink"
        [backLabel]="backLabel"
      >
        <app-status-badge
          headingAside
          [status]="item.status"
        />
      </app-page-header>
      @if (justSubmitted) {
        <app-alert tone="success"
          ><strong>Claim submitted.</strong> Save this reference to track your
          claim.</app-alert
        >
      }
      @if (actionMessage()) {
        <app-alert tone="success">{{ actionMessage() }}</app-alert>
      }
      @if (actionError()) {
        <app-alert tone="danger">{{ actionError() }}</app-alert>
      }
      <div class="detail-grid">
        <div class="detail-main">
          <section class="surface incident-card">
            <app-section-header
              eyebrow="Incident"
              heading="Details of loss"
              ><app-claim-type-icon [type]="item.type"
            /></app-section-header>
            <dl class="detail-list">
              <div>
                <dt>Claim number</dt>
                <dd>{{ item.claimNumber }}</dd>
              </div>
              <div>
                <dt>Policy number</dt>
                <dd>{{ item.policyNumber }}</dd>
              </div>
              <div class="full">
                <dt>Description</dt>
                <dd>{{ item.description }}</dd>
              </div>
            </dl>
          </section>
          @if (item.informationRequests.length) {
            <section class="surface requests-card">
              <app-section-header
                eyebrow="Communication"
                heading="Information requests"
              />
              @for (request of item.informationRequests; track request.id) {
                <article class="request-card">
                  <!-- Each message says who wrote it and when, so a request never reads as a reply and vice versa. -->
                  <app-status-badge [status]="request.status" />
                  <div class="message">
                    <span class="message-label"
                      >{{
                        isOfficer
                          ? 'Request to claimant'
                          : 'Request from your claims officer'
                      }}
                      ·
                      <time>{{
                        request.requestedAt | date: 'd MMM y, h:mm a'
                      }}</time></span
                    >
                    <p class="message-body">{{ request.requestText }}</p>
                  </div>
                  @if (request.responseText) {
                    <div class="message response">
                      <span class="message-label"
                        >{{ isOfficer ? 'Claimant response' : 'Your response' }}
                        @if (request.respondedAt) {
                          ·
                          <time>{{
                            request.respondedAt | date: 'd MMM y, h:mm a'
                          }}</time>
                        }
                      </span>
                      <p class="message-body">{{ request.responseText }}</p>
                    </div>
                  }
                  @if (request.cancellationReason) {
                    <div class="message response">
                      <span class="message-label"
                        >Request cancelled
                        @if (request.cancelledAt) {
                          ·
                          <time>{{
                            request.cancelledAt | date: 'd MMM y, h:mm a'
                          }}</time>
                        }
                      </span>
                      <p class="message-body">
                        Reason: {{ request.cancellationReason }}
                      </p>
                    </div>
                  }
                  @if (!isOfficer && request.status === 'Open') {
                    <mat-form-field class="full-width"
                      ><mat-label>Your response</mat-label
                      ><textarea
                        matInput
                        cdkTextareaAutosize
                        cdkAutosizeMinRows="4"
                        [formControl]="responseText"
                        maxlength="2000"
                      ></textarea></mat-form-field
                    ><button
                      type="button"
                      matButton="filled"
                      (click)="respond(request)"
                      [disabled]="busy()"
                    >
                      <app-icon name="send" />Send response
                    </button>
                  }
                </article>
              }
            </section>
          }
        </div>
        <aside class="detail-side">
          
          <section class="surface summary-card">
            <app-section-header
              [eyebrow]="isOfficer ? 'Claimant' : 'Your details'"
              [heading]="item.claimant.fullName"
            />
            <dl>
              <div>
                <dt>Email</dt>
                <dd>
                  <a [href]="'mailto:' + item.claimant.email">{{
                    item.claimant.email
                  }}</a>
                </dd>
              </div>
              @if (item.claimant.phone) {
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a [href]="'tel:' + item.claimant.phone">{{
                      item.claimant.phone
                    }}</a>
                  </dd>
                </div>
              }
            </dl>
            <mat-divider />
            <dl>
              <div>
                <dt>Assigned officer</dt>
                <dd>
                  {{ item.assignedOfficer?.displayName ?? 'Not assigned' }}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    }
  `,
})
export class ClaimDetails {
  private readonly api = inject(ClaimsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(Identity);
  private readonly dialog = inject(MatDialog);
  protected readonly isOfficer = this.route.snapshot.data['mode'] === 'officer';
  private readonly routes =
    ROLE_ROUTES[this.isOfficer ? 'officer' : 'claimant'];
  protected readonly backLink = this.routes.claims;
  protected readonly backLabel = this.routes.claimsLabel;
  protected readonly claimTypes = CLAIM_TYPES;
  protected readonly justSubmitted =
    window.history.state?.justSubmitted === true;
  protected readonly claim = signal<ClaimDetailsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<{
    icon: IconName;
    title: string;
    message: string;
    retry: boolean;
  } | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  private readonly etag = signal('*');
  private reference = '';
  protected readonly estimate = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/^\d{1,16}(\.\d{1,2})?$/),
    ],
  });
  protected readonly requestText = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, requiredText, Validators.maxLength(2000)],
  });
  protected readonly responseText = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, requiredText, Validators.maxLength(2000)],
  });
  protected readonly cancellationReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, requiredText, Validators.maxLength(500)],
  });
  protected readonly rationale = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, requiredText, Validators.maxLength(2000)],
  });
  protected readonly settlementAmount = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(/^\d{1,16}(\.\d{1,2})?$/)],
  });
  private readonly textControls = [
    this.requestText,
    this.responseText,
    this.cancellationReason,
    this.rationale,
    this.settlementAmount,
  ];
  constructor() {
    // The router reuses this component between claims, so a new reference resets the actions and reloads.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.reference = params.get('reference') ?? '';
      this.actionError.set(null);
      this.actionMessage.set(null);
      this.textControls.forEach((control) => control.reset());
      void this.load();
    });
    let viewerId = this.identity.user()?.id;
    // Same-role demo switches stay on this claim; reload so visibility and actions match the new caller.
    effect(() => {
      const nextId = this.identity.user()?.id;
      if (nextId === viewerId) {
        return;
      }
      viewerId = nextId;
      if (this.reference) {
        this.actionError.set(null);
        this.actionMessage.set(null);
        void this.load();
      }
    });
  }
  protected isMe(id: string | null): boolean {
    return !!id && id === this.identity.user()?.identity;
  }
  protected canManage(): boolean {
    const item = this.claim();
    const user = this.identity.user();
    return (
      !!item &&
      !!user &&
      item.assignedOfficer?.id === user.identity &&
      (item.status === 'UnderReview' || item.status === 'AwaitingInformation')
    );
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [details] = await Promise.all([
        this.api.get(this.reference),
      ]);
      this.claim.set(details.claim);
      this.etag.set(details.etag);
    } catch (error) {
      const problem = this.api.problem(error);
      this.loadError.set(
        problem.status === 404
          ? {
              icon: 'search',
              title: 'Claim not found',
              message: 'This claim does not exist or is not available to you.',
              retry: false,
            }
          : problem.status === 403
            ? {
                icon: 'lock',
                title: 'Not allowed',
                message: 'You do not have access to this claim.',
                retry: false,
              }
            : {
                icon: 'alert-circle',
                title: 'Claim unavailable',
                message: problem.detail ?? 'Something went wrong.',
                retry: true,
              },
      );
    } finally {
      this.loading.set(false);
    }
  }
  protected requestInformation(): Promise<void> {
    if (this.requestText.invalid)
      return this.invalid('Enter the information you need.', this.requestText);
    return this.run(
      'Information request sent to the claimant.',
      () =>
        this.api.requestInformation(
          this.reference,
          this.requestText.value.trim(),
          this.etag(),
        ),
      [this.requestText],
    );
  }
  protected respond(request: InformationRequestResponse): Promise<void> {
    if (this.responseText.invalid)
      return this.invalid('Enter your response.', this.responseText);
    return this.run(
      'Response sent.',
      () =>
        this.api.respond(
          this.reference,
          request.id,
          this.responseText.value.trim(),
          this.etag(),
        ),
      [this.responseText],
    );
  }

  private invalid(
    message: string,
    ...controls: FormControl<string>[]
  ): Promise<void> {
    for (const control of controls) {
      control.markAsTouched();
      // The settlement amount is optional for rejection, so it is flagged here rather than by a required validator.
      if (!control.value) control.setErrors({ required: true });
    }
    this.actionError.set(message);
    return Promise.resolve();
  }
  private async run(
    message: string,
    command: () => Promise<{ claim: ClaimDetailsResponse; etag: string }>,
    clear: FormControl<string>[] = [],
  ): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);
    try {
      const result = await command();
      this.claim.set(result.claim);
      this.etag.set(result.etag);
      this.actionMessage.set(message);
      // Clears the text just sent, so it cannot be sent again by mistake.
      clear.forEach((control) => control.reset());
      // The action has already succeeded, so a failed history refresh keeps the previous history rather than reporting an error.
    } catch (error) {
      const problem = this.api.problem(error);
      this.actionError.set(
        problem.detail ??
          (Object.values(problem.errors ?? {})
            .flat()
            .join(' ') ||
            'The action could not be completed.'),
      );
      // A 409 carries the current claim and ETag, so the officer can review the change and retry without reloading.
      if (problem.claim && problem.etag) {
        this.claim.set(problem.claim);
        this.etag.set(problem.etag);
      } else if ([403, 404, 409].includes(problem.status ?? 0)) {
        try {
          const [current] = await Promise.all([
            this.api.get(this.reference),
          ]);
          this.claim.set(current.claim);
          this.etag.set(current.etag);
        } catch {
          /* The inline error remains the useful state. */
        }
      }
    } finally {
      this.busy.set(false);
    }
  }
}

import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, effect, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { Router, RouterLink } from '@angular/router';

import { ClaimsApi } from '../../core/api/claims-api';
import { ClaimType, SubmitClaimRequest } from '../../core/api/generated';
import { Identity, ROLE_ROUTES } from '../../core/identity/identity';
import { Alert } from '../../shared/ui/alert';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { SectionHeader } from '../../shared/ui/section-header';
import { requiredText } from '../../shared/validators';
import { CLAIM_TYPES } from './claim-type';

@Component({
  imports: [
    MatButtonModule,
    MatInputModule,
    TextFieldModule,
    MatRadioModule,
    ReactiveFormsModule,
    RouterLink,
    Alert,
    Icon,
    PageHeader,
    SectionHeader,
  ],
  selector: 'app-submit-claim',
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 50rem);
      justify-content: center;
    }
    .form-layout {
      display: grid;
      gap: 1rem;
    }
    .form-section {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 1.25rem;
    }
    .form-section > :not(.step-number) {
      grid-column: 2;
    }
    .step-number {
      display: grid;
      grid-row: 1 / span 3;
      width: 2rem;
      height: 2rem;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: var(--navy);
      font-size: var(--text-sm);
      font-weight: 700;
    }
    .choice-cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .choice-cards mat-radio-button {
      display: flex;
      cursor: pointer;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: var(--surface);
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .choice-cards mat-radio-button:not(.mat-mdc-radio-checked):hover {
      border-color: var(--muted);
    }
    .choice-cards mat-radio-button.mat-mdc-radio-checked {
      border-color: var(--navy);
      background: var(--navy-tint);
    }
    .choice-title,
    .choice-description {
      display: block;
    }
    .choice-title {
      color: var(--ink);
      font-size: var(--text-md);
      font-weight: 700;
    }
    .choice-description {
      margin-top: 0.125rem;
      color: var(--muted);
      font-size: var(--text-sm);
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      gap: 0.25rem 1rem;
    }
    .field-grid .full {
      width: 100%;
      grid-column: 1 / -1;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 0.5rem;
    }
    @media (max-width: 36rem) {
      .choice-cards,
      .field-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .form-section {
        grid-template-columns: minmax(0, 1fr);
      }
      .form-section > :not(.step-number) {
        grid-column: 1;
      }
      .step-number {
        grid-row: auto;
        margin-bottom: 1rem;
      }
      .form-actions {
        align-items: stretch;
        flex-direction: column-reverse;
      }
      .form-actions button,
      .form-actions a {
        width: 100%;
      }
    }
  `,
  template: `
    <app-page-header
      eyebrow="Report an incident"
      heading="New claim"
      description="Enter the incident details. You can follow the claim's status after you submit it."
      backLink="/my-claims"
      backLabel="My claims"
    />
    <form
      class="form-layout"
      [formGroup]="form"
      (ngSubmit)="submit()"
    >
      <section class="surface form-section">
        <div class="step-number">1</div>
        <app-section-header
          heading="Claim type"
          description="Choose the type of claim."
        />
        <mat-radio-group
          formControlName="type"
          class="choice-cards"
        >
          <mat-radio-button value="Motor"
            ><strong class="choice-title">Motor</strong
            ><span class="choice-description"
              >Vehicle damage or road incidents</span
            ></mat-radio-button
          >
          <mat-radio-button value="Property"
            ><strong class="choice-title">Property</strong
            ><span class="choice-description"
              >Damage to a home or building</span
            ></mat-radio-button
          >
        </mat-radio-group>
      </section>
      <section class="surface form-section">
        <div class="step-number">2</div>
        <app-section-header
          heading="Incident details"
          description="Describe what happened."
        />
        <div class="field-grid">
          <mat-form-field class="full"
            ><mat-label>Policy number</mat-label
            ><input
              matInput
              formControlName="policyNumber"
              maxlength="50"
              placeholder="POL-123456"
            /><mat-error
              >A policy number is required.</mat-error
            ></mat-form-field>
          <mat-form-field class="full">
            <mat-label>Incident description</mat-label>
            <textarea
              matInput
              cdkTextareaAutosize
              cdkAutosizeMinRows="5"
              formControlName="description"
              maxlength="2000"
              placeholder="Describe how the incident happened and the damage caused"
            ></textarea>
            <mat-error>Enter a description of the incident.</mat-error>
          </mat-form-field>
        </div>
      </section>
      @if (error()) {
        <app-alert tone="danger">{{ error() }}</app-alert>
      }
      <div class="form-actions">
        <a matButton="text" routerLink="/my-claims">Cancel</a>
        <button matButton="filled" type="submit" [disabled]="submitting()">
          <app-icon name="send" />{{ submitting() ? 'Submitting…' : 'Submit claim' }}
        </button>
      </div>
    </form>
  `,
})
export class SubmitClaim {
  private readonly api = inject(ClaimsApi);
  private readonly router = inject(Router);
  private readonly identity = inject(Identity);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly claimTypes = CLAIM_TYPES;
  protected readonly form = new FormGroup({
    type: new FormControl<ClaimType>('Motor', { nonNullable: true }),
    policyNumber: new FormControl('', { nonNullable: true }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        requiredText,
        Validators.maxLength(2000),
      ],
    }),
  });

  constructor() {
    // Pre-fill and lock the policy number when the user has one; unlock it when they don't.
    effect(() => {
      const policyNumber = this.identity.user()?.policyNumber ?? '';
      const control = this.form.controls.policyNumber;
      control.setValue(policyNumber);
      policyNumber ? control.disable() : control.enable();
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const raw = this.form.getRawValue();
      const request: SubmitClaimRequest = {
        claimantMemberNumber: this.identity.user()?.claimantMemberNumber ?? '',
        claimType: raw.type?.toUpperCase() as ClaimType,
        policyNumber: raw.policyNumber.trim(),
        description: raw.description.trim(),
      };
      const result = await this.api.submit(request);
      await this.router.navigate(
        [ROLE_ROUTES.claimant.claims],
        { state: { justSubmitted: true } },
      );
    } catch (error) {
      console.error('Submit claim error:', error);
      const problem = this.api.problem(error);
      console.error('Problem detail:', problem);
      this.error.set(
        problem.detail ??
          (Object.values(problem.errors ?? {})
            .flat()
            .join(' ') ||
            'The claim could not be submitted.'),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}

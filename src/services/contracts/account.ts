import type { Role } from './types';

/**
 * Account, session and trial contract for the standalone prototype. Field names follow the real service
 * (see docs/AUTH_AND_TRIAL_MAP.md): POST /signup, GET /verify-email, POST /login, GET /session,
 * POST /password-reset/request and /confirm, GET /billing/status. Anything the real API does not have
 * (a resend route, a code-based verification) is marked PROTOTYPE-ONLY where it appears.
 */
export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type PlanName = 'starter' | 'growth' | 'business';

/** What the interface needs to know about the trial, derived in one place (services/account.ts). */
export type TrialPhase = 'trial-new' | 'trial' | 'trial-ending' | 'readonly' | 'readonly-ending' | 'retention-ended' | 'active';

export interface OnboardingDraft {
  businessName: string;
  gstin: string;
  stateCode: string;
  taxRate: string;
  sells: 'general' | 'apparel' | 'electronics' | 'grocery';
  catalogue: 'sample' | 'import';
  invites: Array<{ email: string; role: Role }>;
}

export interface PrototypeUser { email: string; pw: string; name: string; businessName: string; tenantId: string }

export interface AccountState {
  /** GET /session */
  session: { authenticated: boolean; userId: string; email: string; name: string; emailVerified: boolean };
  workspace: { name: string; tenantId: string };
  /** GET /billing/status: status, trialEndsAt (plus the start, which the prototype keeps so it can show progress) */
  billing: { status: TenantStatus; plan: PlanName; trialStartedAt: string; trialEndsAt: string };
  /** PROTOTYPE-ONLY: moves "now" so every trial state can be reached without waiting. 0 in normal use. */
  clockShiftMs: number;
  /** when the demonstration verification link was issued (the real link lives 7 days) */
  verification: { issuedAt: string | null };
  /** when the demonstration reset link was requested (the real link lives 1 hour and works once) */
  recovery: { requestedAt: string | null; usedTokens: string[] };
  onboarding: { done: boolean; draft: OnboardingDraft };
  /** people who signed up in this browser; the password is kept only as a non-reversible fingerprint */
  known: PrototypeUser[];
  attempts: { failedLogins: number[]; signups: number[] };
}

export interface SignInInput { email: string; password: string }
export interface SignUpInput { businessName: string; email: string; password: string; acceptedTerms: boolean }

/**
 * Asynchronous because the real service is. The local adapter answers after a short delay and changes only
 * local state; it never sends an email, creates a subscription or contacts a server.
 * Error codes are the real ones where they exist: LOGIN_FAILED, RATE_LIMITED, SIGNUP_EXISTS,
 * VERIFICATION_INVALID, VERIFICATION_UNKNOWN_USER, RESET_TOKEN_INVALID.
 */
export interface AuthService {
  signIn(input: SignInInput): Promise<AuthResult<{ next: string }>>;
  signOut(): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  /** GET /verify-email?token=. Idempotent. */
  verifyEmail(token: string): Promise<AuthResult<{ verified: true }>>;
  /** PROTOTYPE-ONLY. The real API has no resend route; this exists so the expired-link state has a way out. */
  resendVerification(): Promise<AuthResult>;
  /** POST /password-reset/request. Always succeeds, so the screen cannot reveal whether an account exists. */
  requestPasswordReset(email: string): Promise<AuthResult>;
  /** POST /password-reset/confirm. Single use. */
  confirmPasswordReset(token: string, password: string): Promise<AuthResult>;
  /** GET /auth/google/start exists in the real service; it is not connected here. */
  signInWithGoogle(): Promise<AuthResult>;
}

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; code: string; message: string; retryAfterSec?: number };

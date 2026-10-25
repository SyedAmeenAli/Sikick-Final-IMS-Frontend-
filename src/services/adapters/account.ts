/**
 * Local account, session and trial engine. PROTOTYPE ONLY: it answers like the real service would, after a
 * short pause, and changes nothing outside this browser. No email is sent, no subscription is created, no
 * password is changed anywhere real. Verification and reset links are simulated with fixed demo tokens.
 */
import type { AccountState, AuthResult, AuthService, OnboardingDraft, SignInInput, SignUpInput } from '../contracts/account';
import { DAY, TRIAL_DAYS, accountNow, scenarioBilling } from '../account';

export const DEMO_EMAIL = 'ameen@morrowgoods.example';
export const DEMO_PASSWORD = 'Morrow-demo-2026!';
/** the real service answers 429 after repeated failures; its window is not documented, so these are demonstration values */
export const LOCK = { failures: 5, windowMs: 5 * 60_000, lockMs: 45_000 };
export const SIGNUP_LIMIT = { count: 5, windowMs: 5 * 60_000 };
/** real: verification links live 7 days, reset links 1 hour and work once */
export const VERIFY_TTL_MS = 7 * DAY;
export const RESET_TTL_MS = 60 * 60_000;
/** demonstration tokens the pages offer in place of an email */
export const DEMO_TOKENS = { verifyOk: 'valid-demo', verifyExpired: 'expired-demo', verifyUnknown: 'unknown-demo', resetOk: 'reset-valid', resetExpired: 'reset-expired' } as const;

const KEY = 'sikick.account.v1';
const delay = (ms = 650) => new Promise<void>((r) => window.setTimeout(r, ms));
const fp = (pw: string) => { let h = 2166136261; for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const EMAIL = /^\S+@\S+\.\S+$/;
const titleCase = (e: string) => e.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'You';

export const emptyDraft = (businessName = ''): OnboardingDraft => ({ businessName, gstin: '', stateCode: '36', taxRate: '18', sells: 'general', catalogue: 'sample', invites: [] });

export function defaultAccount(): AccountState {
  return {
    /** the hosted build opens at sign-in (VITE_START_SIGNED_OUT=1); the dev server opens already signed in */
    session: { authenticated: import.meta.env.VITE_START_SIGNED_OUT !== '1', userId: 'U-01', email: DEMO_EMAIL, name: 'Ameen Ali', emailVerified: true },
    workspace: { name: 'Morrow Goods', tenantId: 'T-MORROW' },
    billing: scenarioBilling('mid'),
    clockShiftMs: 0,
    verification: { issuedAt: null },
    recovery: { requestedAt: null, usedTokens: [] },
    onboarding: { done: true, draft: emptyDraft('Morrow Goods') },
    known: [],
    attempts: { failedLogins: [], signups: [] },
  };
}

export function loadAccount(): AccountState {
  const base = defaultAccount();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<AccountState>) };
  } catch { /* private window or blocked storage: start from the default */ }
  return base;
}
export function saveAccount(a: AccountState) { try { window.localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ } }

type Edit = (a: AccountState) => void;
export interface EngineDeps { get: () => AccountState; edit: (fn: Edit) => void; setWorkspaceName: (n: string) => void }

const fail = (code: string, message: string, retryAfterSec?: number): AuthResult<never> => ({ ok: false, code, message, ...(retryAfterSec ? { retryAfterSec } : {}) });

export function createAuthService({ get, edit }: EngineDeps): AuthService {
  const now = () => accountNow(get());
  const recent = (xs: number[], windowMs: number) => xs.filter((t) => now() - t < windowMs);

  return {
    async signIn({ email, password }: SignInInput) {
      await delay();
      const e = email.trim().toLowerCase();
      if (!EMAIL.test(e)) return fail('VALIDATION', 'Enter a valid email address.');
      if (!password) return fail('VALIDATION', 'Enter your password.');
      const fails = recent(get().attempts.failedLogins, LOCK.windowMs);
      if (fails.length >= LOCK.failures) {
        const wait = Math.ceil((fails[fails.length - 1] + LOCK.lockMs - now()) / 1000);
        if (wait > 0) return fail('RATE_LIMITED', 'Too many failed login attempts. Wait before trying again.', wait);
      }
      const a = get();
      const known = a.known.find((u) => u.email === e);
      const isDemo = e === DEMO_EMAIL && password === DEMO_PASSWORD;
      const isKnown = !!known && known.pw === fp(password);
      if (!isDemo && !isKnown) {
        edit((x) => { x.attempts.failedLogins = [...recent(x.attempts.failedLogins, LOCK.windowMs), now()]; });
        const left = LOCK.failures - recent(get().attempts.failedLogins, LOCK.windowMs).length;
        return left <= 0 ? fail('RATE_LIMITED', 'Too many failed login attempts. Wait before trying again.', Math.ceil(LOCK.lockMs / 1000)) : fail('LOGIN_FAILED', 'Invalid email or password');
      }
      edit((x) => {
        x.attempts.failedLogins = [];
        x.session = isDemo ? { authenticated: true, userId: 'U-01', email: e, name: 'Ameen Ali', emailVerified: true } : { authenticated: true, userId: 'U-' + known!.tenantId.slice(-4), email: e, name: known!.name, emailVerified: x.session.email === e ? x.session.emailVerified : false };
        if (known) x.workspace = { name: known.businessName, tenantId: known.tenantId };
        else if (isDemo) x.workspace = { name: 'Morrow Goods', tenantId: 'T-MORROW' };
      });
      return { ok: true, value: { next: get().onboarding.done ? '/dashboard' : '/onboarding/start' } };
    },

    async signOut() {
      await delay(250);
      edit((x) => { x.session.authenticated = false; });
      return { ok: true, value: undefined };
    },

    async signUp({ businessName, email, password, acceptedTerms }: SignUpInput) {
      await delay(800);
      const e = email.trim().toLowerCase();
      if (!businessName.trim()) return fail('VALIDATION', 'Tell us your business name.');
      if (!EMAIL.test(e)) return fail('VALIDATION', 'Enter a valid email address.');
      if (password.length < 12) return fail('VALIDATION', 'Use at least 12 characters.');
      if (!acceptedTerms) return fail('VALIDATION', 'Accept the terms of service to continue.');
      const recentSignups = recent(get().attempts.signups, SIGNUP_LIMIT.windowMs);
      if (recentSignups.length >= SIGNUP_LIMIT.count) return fail('RATE_LIMITED', 'Too many signup attempts. Wait before trying again.', 60);
      edit((x) => { x.attempts.signups = [...recentSignups, now()]; });
      if (e === DEMO_EMAIL || get().known.some((u) => u.email === e)) return fail('SIGNUP_EXISTS', 'An account with this email already exists.');
      const t = now();
      const tenantId = 'T-' + fp(e + t).toUpperCase().slice(0, 6);
      edit((x) => {
        x.known = [...x.known, { email: e, pw: fp(password), name: titleCase(e), businessName: businessName.trim(), tenantId }];
        x.session = { authenticated: true, userId: 'U-' + tenantId.slice(-4), email: e, name: titleCase(e), emailVerified: false };
        x.workspace = { name: businessName.trim(), tenantId };
        // the trial clock starts here, at account creation, and not before
        x.billing = { status: 'trial', plan: 'starter', trialStartedAt: new Date(t).toISOString(), trialEndsAt: new Date(t + TRIAL_DAYS * DAY).toISOString() };
        x.verification = { issuedAt: new Date(t).toISOString() };
        x.onboarding = { done: false, draft: emptyDraft(businessName.trim()) };
      });
      return { ok: true, value: undefined };
    },

    async verifyEmail(token: string) {
      await delay(700);
      if (token === DEMO_TOKENS.verifyUnknown) return fail('VERIFICATION_UNKNOWN_USER', 'No account matches this verification link');
      const issued = get().verification.issuedAt;
      const expired = token === DEMO_TOKENS.verifyExpired || (issued !== null && now() - new Date(issued).getTime() > VERIFY_TTL_MS);
      if (token !== DEMO_TOKENS.verifyOk || expired) return fail('VERIFICATION_INVALID', 'This verification link is invalid or has expired');
      edit((x) => { x.session.emailVerified = true; });
      return { ok: true, value: { verified: true as const } };
    },

    async resendVerification() {
      await delay(500);
      edit((x) => { x.verification.issuedAt = new Date(now()).toISOString(); });
      return { ok: true, value: undefined };
    },

    async requestPasswordReset(email: string) {
      await delay(700);
      if (!EMAIL.test(email.trim())) return fail('VALIDATION', 'Enter a valid email address.');
      edit((x) => { x.recovery.requestedAt = new Date(now()).toISOString(); });
      return { ok: true, value: undefined };   // the same answer whether or not the account exists
    },

    async confirmPasswordReset(token: string, password: string) {
      await delay(700);
      if (password.length < 12) return fail('VALIDATION', 'Use at least 12 characters.');
      const a = get();
      const requested = a.recovery.requestedAt ? new Date(a.recovery.requestedAt).getTime() : null;
      const expired = token === DEMO_TOKENS.resetExpired || (requested !== null && now() - requested > RESET_TTL_MS);
      if (token !== DEMO_TOKENS.resetOk || expired || a.recovery.usedTokens.includes(token + ':' + (a.recovery.requestedAt ?? 'none'))) {
        return fail('RESET_TOKEN_INVALID', 'This reset link is invalid, expired, or has already been used.');
      }
      edit((x) => {
        x.recovery.usedTokens = [...x.recovery.usedTokens, token + ':' + (x.recovery.requestedAt ?? 'none')];
        // only a prototype account made in this browser has a password to change; the built-in demo account keeps its own
        const u = x.known.find((k) => k.email === x.session.email) ?? null;
        if (u) u.pw = fp(password);
      });
      return { ok: true, value: undefined };
    },

    async signInWithGoogle() {
      await delay(400);
      return fail('NOT_CONNECTED', 'Google sign-in is not connected in this prototype.');
    },
  };
}

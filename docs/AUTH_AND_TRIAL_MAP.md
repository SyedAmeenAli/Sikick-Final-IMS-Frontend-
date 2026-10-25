# Sign-in, verification, recovery and trial: contract map

Every screen was built against what the real service does (read from `ims-final-built`, never changed): `docs/api-reference.md`, `src/api/routes/signup.routes.ts`, `owner.routes.ts`, `src/application/services/email-verification.service.ts`, `billing.service.ts`, `retention.service.ts`, and the web client's `SignupPage`, `ResetPasswordPage`, `OwnerGate`, `AuthContext` and `api/billing.ts`. The prototype's adapter (`src/services/adapters/account.ts`) answers in the same shapes and with the same error codes, locally.

## What the real service actually does, and so what was built

| Journey | Real contract | Screen here | Notes |
|---|---|---|---|
| Sign in | `POST /login` `{email, password}` sets the `ims_session` cookie. Failure: 401 `LOGIN_FAILED` "Invalid email or password" (identical for unknown email and wrong password). Repeated failures: 429 "Too many failed login attempts. Wait before trying again." | `/login` | Remember-me is not offered: the session is a fixed 12-hour cookie. Google sign-in exists (`GET /auth/google/start`); the button is present and says it is not connected. No "locked or disabled account" screen: the only lockout the service has is the rate limit, which is shown with a countdown. |
| Session | `GET /session` → `authenticated, userId, email, role, tenantId, shops, impersonatedBy` | `AccountState.session` | Unauthenticated visits to any workspace route go to `/login?next=`. |
| Create account | `POST /signup` `{businessName, email, password ≥ 12}` creates the tenant and the admin user, starts the **14-day trial on the starter plan**, signs you in. 409 `SIGNUP_EXISTS`; 429 `RATE_LIMITED` (5 per 5 minutes per IP). Terms acceptance is a checkbox only | `/signup` (two steps) | The two steps only ask for the same four things in a kinder order. The trial clock starts when the account is created. |
| Email verification | **A link, not a code.** `GET /verify-email?token=`: HMAC-signed, valid 7 days, idempotent. 400 `VERIFICATION_INVALID` "invalid or has expired"; 404 `VERIFICATION_UNKNOWN_USER`. Sending is fire-and-forget and **never gates anything** | `/verify-email` | No OTP or code-entry screen was built, because the service has none. The "expired code" requirement is met by the expired-link state. |
| Reset request | `POST /password-reset/request` `{email}` always answers the same | `/reset-password` | The screen says "If an account exists…" and never confirms or denies. |
| Reset confirm | `POST /password-reset/confirm` `{token, password ≥ 12}`: single use, 1 hour. 400 `RESET_TOKEN_INVALID` for expired, used or forged alike | `/reset-password?token=` | One error screen for all three causes, as the service intends. The confirmation field is a client-side nicety; the API takes one password. |
| Trial status | `GET /billing/status` → `{status: trial \| active \| past_due \| suspended \| cancelled, trialEndsAt, currentPeriodEnd, subscriptionId}` | `AccountState.billing` | `trialStartedAt` is kept by the prototype only so progress can be drawn (the service has `trialEndsAt` only). |
| Trial expiry | A scheduled job (`expireSubscriptions`) flips `trial` tenants past `trialEndsAt` to `suspended` and sets `deactivatedAt`. From then every write returns 402 `SUBSCRIPTION_INACTIVE`; **reads and exports are never blocked** | trial notice, `/trial-ended`, `/account/export`, paused till | The prototype derives the phase from `trialEndsAt` and the clock; see "Gaps". |
| Retention | `suspended`/`cancelled` for 90 days with no reactivation: archived. A tenant with no stock movement is archived **and deleted**; one that ever traded is archived and **kept for review** (those are real records) | `/trial-ended`, notice, `PausedGate` | The copy states both outcomes. The prototype deletes nothing. |
| Plan | `POST /billing/subscribe {plan}` returns a checkout URL; the plan is granted only when the payment provider confirms | `/settings/billing` | "Choose a plan" says it is not connected and changes nothing. |

## States and where they live

All of it is one record, `ImsState.account` (`src/services/contracts/account.ts`), read through `useTrial()`, which calls `trialInfo()` in `src/services/account.ts`. No component counts down on its own, and the only timer is one 30-second tick in the provider so day counts re-evaluate together.

| Phase | When | Workspace | Shown as |
|---|---|---|---|
| `trial-new` | first day | read/write | menu pill "Trial · 14 days left" |
| `trial` | day 2 to 11 | read/write | menu pill |
| `trial-ending` | 3 days or fewer | read/write | slim notice, dismissible for the visit |
| `readonly` | trial ended, more than 14 days of the 90 left | **read-only** | notice, paused till, refused writes |
| `readonly-ending` | 14 days or fewer left to export | read-only | the same, in a stronger tone |
| `retention-ended` | 90 days after expiry | **archived**: every route is replaced by an explanation | `/trial-ended` stays reachable |
| `active` | a paid plan | read/write | "Active plan" |

Read-only is enforced in the store: every mutating command except preferences returns `SUBSCRIPTION_INACTIVE` (the 402 rule), raises one toast, and changes nothing. The till and the archived workspace are paused at route level with an explanation and the way out (export, review plans).

## Prototype-only pieces (never in the ordinary interface)

- Demo account `ameen@morrowgoods.example` / `Morrow-demo-2026!`; accounts made in this browser also sign in (the password is kept only as a non-reversible fingerprint in `localStorage`).
- Demonstration tokens stand in for email links: `valid-demo`, `expired-demo`, `unknown-demo`, `reset-valid`, `reset-expired`. A verification link also expires when the prototype clock passes 7 days from issue; a reset link after 1 hour.
- The sign-in throttle (5 failures, 45 s) and sign-up limit (5 per 5 minutes) use demonstration values: the service's real windows are not exposed.
- **Resend verification** is simulated. The real API has no such route.
- `?dev=1` shows a small "Prototype states" panel (remembered in this browser, `?dev=0` removes it). `?scenario=new|mid|ending|expired|readonly-ending|retention-ended|paid` and `?session=out` apply a state from a link; `+1 / +7 / +30 days` moves the one prototype clock.
- Nothing is sent: no email, no request of any kind (there are zero non-GET requests, checked in the browser), no subscription, no real password change.

## Gaps in the real contract (reported, not invented)

1. **No resend-verification route.** An expired link has no way out except signing up again or the prototype's simulated resend.
2. **No retention deadline on `GET /billing/status`.** The 90 days run from `deactivatedAt`, which the endpoint does not return; the client can only estimate it from `trialEndsAt`. To show an exact date, status needs `deactivatedAt` (or `retentionEndsAt`).
3. **`status` stays `trial` between `trialEndsAt` and the next sweep run**, so a client reading status alone can show an expired trial as running. The prototype uses the date.
4. **No export-all endpoint.** The export page builds files in the browser from data it already loaded; a live version needs per-resource export or a bulk export route that stays open when suspended.
5. **No login lock-out screen contract** beyond the 429; no MFA, invitation-acceptance or account-recovery flow exists in the API, so none was built.
6. **GET /session does not carry `emailVerified`**; the prototype's "verify your email" state needs it.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthLayout, EMAIL_OK, FormAlert, PasswordField, PasswordRule, Stepper } from '@/features/auth/kit';
import { useAuth } from '@/services';
import { GoogleButton } from './LoginPage';

/**
 * POST /signup takes exactly: businessName, email, password (12 or more characters) and the terms. It creates the
 * workspace and its 14-day trial in one call. The two steps here are only a kinder way to ask for those four things;
 * going back keeps what was typed.
 */
export default function SignupPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ businessName: '', email: '', password: '', terms: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const set = (patch: Partial<typeof f>) => { setF((x) => ({ ...x, ...patch })); setProblem(null); };

  const first = (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!f.businessName.trim()) x.businessName = 'Tell us your business name.';
    if (!f.email.trim()) x.email = 'Enter your email address.'; else if (!EMAIL_OK(f.email)) x.email = 'Enter a valid email address.';
    setErr(x);
    if (!Object.keys(x).length) setStep(1);
  };
  const second = async (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (f.password.length < 12) x.password = 'Use at least 12 characters.';
    if (!f.terms) x.terms = 'Accept the terms of service to continue.';
    setErr(x);
    if (Object.keys(x).length) return;
    setBusy(true); setProblem(null);
    const r = await auth.signUp({ businessName: f.businessName, email: f.email, password: f.password, acceptedTerms: f.terms });
    setBusy(false);
    if (r.ok) { nav('/onboarding/start', { replace: true }); return; }
    if (r.code === 'SIGNUP_EXISTS') { setStep(0); setErr({ email: 'An account with this email already exists.' }); return; }
    setProblem({ code: r.code, message: r.message });
  };

  return (
    <AuthLayout>
      <Stepper step={step} labels={['Your business', 'Secure your account']} label="14-day trial, no card" />
      {step === 0 ? (
        <form className="stack" onSubmit={first} noValidate style={{ gap: 14 }}>
          <div><h1>Start your trial</h1><p className="lede">Two quick steps. The trial begins when your account is created, not before.</p></div>
          <Field label="Business name" error={err.businessName}>{(id) => <Input id={id} value={f.businessName} onChange={(e) => set({ businessName: e.target.value })} autoComplete="organization" autoFocus aria-invalid={err.businessName ? true : undefined} />}</Field>
          <Field label="Work email" error={err.email} help={err.email?.includes('already') ? undefined : 'We will send a verification link here. You can start using the workspace before you open it.'}>
            {(id) => <Input id={id} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={err.email ? true : undefined} />}
          </Field>
          {err.email?.includes('already') && <p className="muted" style={{ marginTop: -6 }}>That email is already registered. <Link className="link" to="/login">Sign in instead</Link>.</p>}
          <Button variant="primary" size="lg" type="submit">Continue<ArrowRight aria-hidden /></Button>
          <div className="or"><span>or</span></div>
          <GoogleButton label="Sign up with Google" />
        </form>
      ) : (
        <form className="stack" onSubmit={second} noValidate style={{ gap: 14 }}>
          <div><h1>Secure your account</h1><p className="lede">{f.businessName.trim()} · {f.email.trim()}</p></div>
          {problem && <FormAlert title={problem.code === 'RATE_LIMITED' ? 'Too many attempts' : 'Could not create the account'}>{problem.message}</FormAlert>}
          <PasswordField label="Password" value={f.password} onChange={(v) => set({ password: v })} error={err.password} autoComplete="new-password" autoFocus disabled={busy} />
          <PasswordRule value={f.password} />
          <Field label="" error={err.terms}>{(id) => (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--fs-md)' }}>
              <input id={id} type="checkbox" checked={f.terms} onChange={(e) => set({ terms: e.target.checked })} disabled={busy} style={{ marginTop: 3, accentColor: 'var(--wine)' }} />
              <span>I accept the terms of service and understand the workspace turns read-only when the trial ends.</span>
            </label>
          )}</Field>
          <div className="form-actions">
            <Button type="button" onClick={() => { setStep(0); setErr({}); }} disabled={busy}><ArrowLeft aria-hidden />Back</Button>
            <Button variant="primary" size="lg" type="submit" disabled={busy} aria-busy={busy}>{busy ? <><Loader2 className="spin" aria-hidden />Creating your workspace…</> : 'Create account'}</Button>
          </div>
        </form>
      )}
      <p className="auth-foot">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}

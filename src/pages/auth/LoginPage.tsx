import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthLayout, EMAIL_OK, FormAlert, PasswordField, ProtoNote } from '@/features/auth/kit';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/services/adapters/account';
import { useAuth, useIms } from '@/services';

type Problem = { code: string; message: string } | null;

/** Mirrors the real sign-in: email and password, a generic failure message, and a throttle after repeated failures. */
export default function LoginPage() {
  const auth = useAuth();
  const s = useIms();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  const pwRef = useRef<HTMLInputElement>(null);
  const next = q.get('next') && q.get('next')!.startsWith('/') ? q.get('next')! : null;

  useEffect(() => {
    if (!until) return;
    const tick = () => { const l = Math.max(0, Math.ceil((until - Date.now()) / 1000)); setLeft(l); if (!l) { setUntil(0); setProblem(null); } };
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [until]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldErr = {};
    if (!email.trim()) fe.email = 'Enter your email address.'; else if (!EMAIL_OK(email)) fe.email = 'Enter a valid email address.';
    if (!password) fe.password = 'Enter your password.';
    setFieldErr(fe);
    if (fe.email || fe.password) { setProblem(null); return; }
    setBusy(true); setProblem(null);
    const r = await auth.signIn({ email, password });
    setBusy(false);
    if (r.ok) { nav(next ?? r.value.next, { replace: true }); return; }
    setPassword('');
    setProblem({ code: r.code, message: r.message });
    if (r.code === 'RATE_LIMITED' && r.retryAfterSec) setUntil(Date.now() + r.retryAfterSec * 1000);
    else pwRef.current?.focus();
  };

  if (s.account.session.authenticated) {
    return (
      <AuthLayout>
        <div><h1>You are signed in</h1><p className="lede">As {s.account.session.email}, in {s.account.workspace.name}.</p></div>
        <Button variant="primary" size="lg" onClick={() => nav(next ?? '/dashboard')}>Continue to the workspace</Button>
        <Button onClick={() => void auth.signOut()}>Sign out and use another account</Button>
      </AuthLayout>
    );
  }

  const locked = until > Date.now() && left > 0;
  return (
    <AuthLayout>
      <div><h1>Sign in</h1><p className="lede">Use your Sikick account to open the workspace.</p></div>
      <form className="stack" onSubmit={submit} noValidate style={{ gap: 14 }}>
        {problem && problem.code === 'LOGIN_FAILED' && <FormAlert title="Could not sign in">Invalid email or password. Check them and try again, or <Link className="link" to="/reset-password">reset your password</Link>.</FormAlert>}
        {problem && problem.code === 'RATE_LIMITED' && <FormAlert title="Too many attempts">{problem.message}{locked ? ' Try again in ' + left + ' s.' : ''}</FormAlert>}
        {problem && problem.code === 'VALIDATION' && <FormAlert>{problem.message}</FormAlert>}
        <Field label="Email" error={fieldErr.email}>{(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus aria-invalid={fieldErr.email ? true : undefined} disabled={busy} />}</Field>
        <PasswordField value={password} onChange={setPassword} error={fieldErr.password} autoComplete="current-password" disabled={busy} inputRef={pwRef} />
        <div className="row between" style={{ marginTop: -4 }}><span /><Link className="link" to="/reset-password">Forgot password?</Link></div>
        <Button variant="primary" size="lg" type="submit" disabled={busy || locked} aria-busy={busy}>{busy ? <><Loader2 className="spin" aria-hidden />Signing in…</> : locked ? 'Try again in ' + left + ' s' : <><LogIn aria-hidden />Sign in</>}</Button>
      </form>
      <div className="or"><span>or</span></div>
      <GoogleButton />
      <ProtoNote title="Prototype sign-in">
        <span>Demo account: <span className="mono">{DEMO_EMAIL}</span> with <span className="mono">{DEMO_PASSWORD}</span>. Accounts you create here also work, in this browser only.</span>
        <span className="actions"><Button size="sm" type="button" onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setFieldErr({}); setProblem(null); }}>Fill in the demo account</Button></span>
      </ProtoNote>
      <p className="auth-foot">New to Sikick? <Link to="/signup">Start your 14-day trial</Link></p>
    </AuthLayout>
  );
}

export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const auth = useAuth();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Button type="button" disabled={busy} onClick={async () => { setBusy(true); const r = await auth.signInWithGoogle(); setBusy(false); if (!r.ok) setNote(r.message); }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z" /><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.6 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6z" /><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7l3.8 3C6.5 6.8 9 4.8 12 4.8z" /></svg>
        {busy ? 'Checking…' : label}
      </Button>
      {note && <p className="muted" role="status" style={{ fontSize: 'var(--fs-sm)' }}>{note} The real service supports it; here, use your email and password.</p>}
    </div>
  );
}

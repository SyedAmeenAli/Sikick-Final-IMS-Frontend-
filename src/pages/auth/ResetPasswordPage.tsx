import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2, LinkIcon, Mail, TimerOff } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthLayout, EMAIL_OK, FormAlert, PasswordField, PasswordRule, ProtoNote, StateArt } from '@/features/auth/kit';
import { DEMO_TOKENS } from '@/services/adapters/account';
import { useAuth } from '@/services';

/**
 * Two steps on one path, as in the real service. No token: ask for a link (POST /password-reset/request, which answers the
 * same whether or not the account exists, so this screen says the same too). A token: choose a password
 * (POST /password-reset/confirm: single use, expires after an hour, 12 or more characters).
 */
export default function ResetPasswordPage() {
  const [q] = useSearchParams();
  const token = q.get('token');
  return <AuthLayout>{token ? <Confirm token={token} /> : <Request />}</AuthLayout>;
}

function Request() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_OK(email)) { setErr(email.trim() ? 'Enter a valid email address.' : 'Enter the email address on your account.'); return; }
    setErr(null); setBusy(true);
    const r = await auth.requestPasswordReset(email);
    setBusy(false);
    if (r.ok) setSent(true); else setErr(r.message);
  };

  if (sent) return (
    <>
      <StateArt icon={Mail} />
      <div><h1>Check your email</h1><p className="lede">If an account exists for <b>{email.trim()}</b>, a password reset link is on its way. The link works once and expires in 1 hour.</p></div>
      <ProtoNote title="Prototype: simulate the email">
        <span>This prototype sends nothing. Open one of these in place of the link:</span>
        <span className="actions">
          <Link className="btn btn-sm" to={'/reset-password?token=' + DEMO_TOKENS.resetOk}>Valid link</Link>
          <Link className="btn btn-sm" to={'/reset-password?token=' + DEMO_TOKENS.resetExpired}>Expired link</Link>
        </span>
      </ProtoNote>
      <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
    </>
  );
  return (
    <form className="stack" onSubmit={submit} noValidate style={{ gap: 14 }}>
      <div><h1>Reset your password</h1><p className="lede">Enter the email on your account and we will send a link to choose a new password.</p></div>
      {err && !err.startsWith('Enter') && <FormAlert>{err}</FormAlert>}
      <Field label="Email" error={err?.startsWith('Enter') ? err : undefined}>{(id) => <Input id={id} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} autoFocus disabled={busy} />}</Field>
      <Button variant="primary" size="lg" type="submit" disabled={busy} aria-busy={busy}>{busy ? <><Loader2 className="spin" aria-hidden />Sending…</> : 'Send reset link'}</Button>
      <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
    </form>
  );
}

function Confirm({ token }: { token: string }) {
  const auth = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<{ pw?: string; again?: string }>({});
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>('form');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: typeof err = {};
    if (pw.length < 12) x.pw = 'Use at least 12 characters.';
    if (again !== pw) x.again = 'The two passwords do not match.';
    setErr(x);
    if (x.pw || x.again) return;
    setBusy(true);
    const r = await auth.confirmPasswordReset(token, pw);
    setBusy(false);
    if (r.ok) setState('done');
    else if (r.code === 'RESET_TOKEN_INVALID') setState('invalid');
    else setErr({ pw: r.message });
  };

  if (state === 'done') return (
    <>
      <StateArt tone="ok" icon={CheckCircle2} />
      <div><h1>Password updated</h1><p className="lede">Sign in with your new password. The link you used cannot be used again.</p></div>
      <Button variant="primary" size="lg" onClick={() => nav('/login')}>Go to sign in</Button>
      <ProtoNote><span>Prototype: no real password was changed. Only accounts created in this browser have a password to change.</span></ProtoNote>
    </>
  );
  if (state === 'invalid') return (
    <>
      <StateArt tone="warn" icon={TimerOff} />
      <div><h1>This link no longer works</h1><p className="lede">This reset link is invalid, expired, or has already been used. Request a new one and use it within the hour.</p></div>
      <Link className="btn btn-primary btn-lg" to="/reset-password"><LinkIcon aria-hidden />Request a new link</Link>
      <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
    </>
  );
  return (
    <form className="stack" onSubmit={submit} noValidate style={{ gap: 14 }}>
      <div><StateArt icon={KeyRound} /><h1 style={{ marginTop: 14 }}>Choose a new password</h1><p className="lede">It must be at least 12 characters.</p></div>
      <PasswordField label="New password" value={pw} onChange={(v) => { setPw(v); setErr({}); }} error={err.pw} autoComplete="new-password" autoFocus disabled={busy} />
      <PasswordRule value={pw} />
      <PasswordField label="Confirm new password" value={again} onChange={(v) => { setAgain(v); setErr({}); }} error={err.again} autoComplete="new-password" disabled={busy} />
      <Button variant="primary" size="lg" type="submit" disabled={busy} aria-busy={busy}>{busy ? <><Loader2 className="spin" aria-hidden />Saving…</> : 'Set new password'}</Button>
      <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
    </form>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, MailCheck, MailQuestion, UserX } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { AuthLayout, ProtoNote, StateArt } from '@/features/auth/kit';
import { DEMO_TOKENS } from '@/services/adapters/account';
import { useAuth, useIms } from '@/services';

type View = { kind: 'waiting' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'invalid' } | { kind: 'unknown' };

/**
 * GET /verify-email?token= is the real contract: a link in the email, no code to type. The token is HMAC-signed, lives
 * 7 days, and following it twice is fine. Signing up never waits for it, so an unverified account can already work.
 * No token here means "you have been sent a link"; a token resolves to one of the states below.
 */
export default function VerifyEmailPage() {
  const auth = useAuth();
  const s = useIms();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const token = q.get('token');
  const [view, setView] = useState<View>(token ? { kind: 'checking' } : { kind: 'waiting' });
  const [sent, setSent] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!token) { setView({ kind: 'waiting' }); return; }
    if (ran.current === token) return;
    ran.current = token;
    setView({ kind: 'checking' });
    auth.verifyEmail(token).then((r) => {
      if (r.ok) setView({ kind: 'ok' });
      else setView({ kind: r.code === 'VERIFICATION_UNKNOWN_USER' ? 'unknown' : 'invalid' });
    });
  }, [token, auth]);

  const resend = async () => {
    setResending(true);
    await auth.resendVerification();
    setResending(false);
    setSent('A new link was simulated. Nothing was emailed.');
    nav('/verify-email', { replace: true });
  };

  const email = s.account.session.email;
  const go = s.account.session.authenticated ? (s.account.onboarding.done ? '/dashboard' : '/onboarding/start') : '/login';

  return (
    <AuthLayout>
      {view.kind === 'checking' && (<>
        <StateArt icon={Loader2} /><div><h1>Checking your link</h1><p className="lede">One moment.</p></div>
      </>)}
      {view.kind === 'ok' && (<>
        <StateArt tone="ok" icon={CheckCircle2} />
        <div><h1>Email verified</h1><p className="lede">Thank you. Following this link again is harmless.</p></div>
        <Button variant="primary" size="lg" onClick={() => nav(go)}>{s.account.session.authenticated ? 'Continue' : 'Go to sign in'}</Button>
      </>)}
      {view.kind === 'invalid' && (<>
        <StateArt tone="warn" icon={Clock} />
        <div><h1>This link has expired</h1><p className="lede">This verification link is invalid or has expired. Links work for 7 days.</p></div>
        <Button variant="primary" size="lg" onClick={resend} disabled={resending}>{resending ? 'Sending…' : 'Send a new link'}</Button>
        <ProtoNote><span>The live service has no resend route yet, so this button only simulates one. It will be wired when the service offers it (see docs/AUTH_AND_TRIAL_MAP.md).</span></ProtoNote>
        <p className="auth-foot"><Link to={go}>Continue without verifying</Link></p>
      </>)}
      {view.kind === 'unknown' && (<>
        <StateArt tone="bad" icon={UserX} />
        <div><h1>No account matches this link</h1><p className="lede">No account matches this verification link. It may belong to an account that was removed.</p></div>
        <Link className="btn btn-primary btn-lg" to="/signup">Create an account</Link>
        <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
      </>)}
      {view.kind === 'waiting' && (<>
        <StateArt icon={s.account.session.emailVerified ? MailCheck : MailQuestion} tone={s.account.session.emailVerified ? 'ok' : 'wine'} />
        <div>
          <h1>{s.account.session.emailVerified ? 'Your email is verified' : 'Check your email'}</h1>
          <p className="lede">{s.account.session.emailVerified ? 'Nothing more to do here.' : <>A verification link is sent to <b>{email || 'your address'}</b> when you sign up. It works for 7 days, and you can use the workspace before you open it.</>}</p>
        </div>
        {sent && <p role="status" className="muted">{sent}</p>}
        <Button variant="primary" size="lg" onClick={() => nav(go)}>Continue</Button>
        {!s.account.session.emailVerified && (
          <ProtoNote title="Prototype: simulate the email">
            <span>No email is sent from this prototype. Open one of these instead of the link you would receive:</span>
            <span className="actions">
              <Link className="btn btn-sm" to={'/verify-email?token=' + DEMO_TOKENS.verifyOk}>Valid link</Link>
              <Link className="btn btn-sm" to={'/verify-email?token=' + DEMO_TOKENS.verifyExpired}>Expired link</Link>
              <Link className="btn btn-sm" to={'/verify-email?token=' + DEMO_TOKENS.verifyUnknown}>Unknown account</Link>
            </span>
          </ProtoNote>
        )}
      </>)}
    </AuthLayout>
  );
}

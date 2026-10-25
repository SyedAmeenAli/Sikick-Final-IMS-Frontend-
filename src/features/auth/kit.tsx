import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, Check, Eye, EyeOff, Layers, PackageCheck, Sparkles } from 'lucide-react';
import { SiBorgArt, SikickLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Field, Input } from '@/components/ui/primitives';
import { ease } from '@/animations/motion';
import { DevPanel } from './DevPanel';

/** The composition used by every sign-in, recovery and setup screen: form on one side, product context on the other. */
export function AuthLayout({ children, side = true, topRight }: { children: ReactNode; side?: boolean; topRight?: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main" id="main">
        <div className="auth-top">
          <Link to="/login" aria-label="Sikick"><SikickLogo height={30} /></Link>
          <span className="actions">{topRight}<ThemeToggle /></span>
        </div>
        <div className="auth-center">
          <motion.div className="panel glass auth-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease }}>
            {children}
          </motion.div>
        </div>
        <p className="auth-legal">Prototype: nothing here is sent anywhere. No email, no account and no payment is real.</p>
      </main>
      {side && (
        <aside className="auth-side" aria-label="About Sikick">
          <SiBorgArt width={240} />
          <div>
            <h2>Know what is on the shelf, and what to do next.</h2>
            <p className="quote" style={{ marginTop: 10 }}>Stock, till, purchasing and books in one calm place, with SiBorg reading the same records and proposing, never acting without you.</p>
          </div>
          <ul>
            <li><PackageCheck aria-hidden /><span>Counts that always agree: stock is the sum of its events.</span></li>
            <li><Layers aria-hidden /><span>One workspace for the till, purchasing, GST and reports.</span></li>
            <li><Sparkles aria-hidden /><span>14 days free, no card. After that it turns read-only, and you can export everything.</span></li>
          </ul>
        </aside>
      )}
      <DevPanel />
    </div>
  );
}

export function PasswordField({ label = 'Password', value, onChange, error, help, autoComplete, autoFocus, id: given, inputRef, ...rest }: { label?: string; value: string; onChange: (v: string) => void; error?: string; help?: ReactNode; autoComplete?: string; autoFocus?: boolean; id?: string; inputRef?: React.Ref<HTMLInputElement> } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} help={help}>
      {(id) => (
        <span className="pw">
          <Input ref={inputRef} id={given ?? id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} aria-invalid={error ? true : undefined} {...rest} />
          <button type="button" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((x) => !x)}>{show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</button>
        </span>
      )}
    </Field>
  );
}

/** The one password rule the real service enforces: at least 12 characters. */
export function PasswordRule({ value }: { value: string }) {
  const met = value.length >= 12;
  return <div className="req" data-met={met}><i aria-hidden><Check /></i><span>At least 12 characters{value ? ' (' + value.length + ')' : ''}</span></div>;
}

export function FormAlert({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="alert-box nudge" role="alert"><AlertTriangle aria-hidden /><div>{title && <strong>{title}. </strong>}{children}</div></div>;
}

/** Clearly marks anything that exists only so the prototype can show a state. */
export function ProtoNote({ title = 'Prototype', children }: { title?: string; children: ReactNode }) {
  return <div className="proto"><b>{title}</b>{children}</div>;
}

export function StateArt({ tone = 'wine', icon: Icon }: { tone?: 'wine' | 'ok' | 'bad' | 'warn'; icon: React.ComponentType }) {
  return <span className="state-art" data-tone={tone} aria-hidden><Icon /></span>;
}

export function Stepper({ step, labels, label }: { step: number; labels: string[]; label: string }) {
  const id = useId();
  return (
    <div className="stepper" role="group" aria-labelledby={id}>
      <div className="stepper-top"><span id={id}><b>Step {step + 1} of {labels.length}</b> · {labels[step]}</span><span>{label}</span></div>
      <div className="stepper-bars" aria-hidden>{labels.map((l, i) => <i key={l} data-state={i < step ? 'done' : i === step ? 'now' : 'todo'} />)}</div>
    </div>
  );
}

export const EMAIL_OK = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

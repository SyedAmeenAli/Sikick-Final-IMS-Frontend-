import { forwardRef, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatedNumber } from './AnimatedNumber';
import type { NumFormat } from '@/lib/numfmt';
import { motion, useReducedMotion } from 'motion/react';
import { Info } from 'lucide-react';
import { group, item, glassItem } from '@/animations/motion';
import { observeReveal } from '@/lib/reveal';
import { playUiConfirm } from '@/lib/sound';

/* ---------- buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'default', size = 'md', icon, className = '', type = 'button', ...rest }, ref) {
  const cls = ['btn', variant !== 'default' && 'btn-' + variant, size !== 'md' && 'btn-' + size, icon && 'btn-icon', className].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={cls} {...rest} />;
});

/* ---------- chips ---------- */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'wine' | 'neutral';
export function Chip({ tone = 'neutral', children, plain }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={'chip' + (plain ? ' plain' : '')} data-tone={tone}>{children}</span>;
}
const TONES: Record<string, Tone> = {
  Draft: 'neutral', Pending: 'warn', Paid: 'info', Packed: 'info', Shipped: 'wine', Delivered: 'ok', Completed: 'ok', Cancelled: 'bad', Returned: 'warn', Refunded: 'warn',
  Ordered: 'info', Received: 'ok',
  active: 'ok', invited: 'warn', disabled: 'neutral', revoked: 'bad',
  sent: 'info', accepted: 'ok', rejected: 'bad', expired: 'neutral', converted: 'wine', draft: 'neutral',
  critical: 'bad', high: 'bad', medium: 'warn', low: 'info',
  out: 'bad', ok: 'ok', proposed: 'wine', approved: 'ok',
};
export const StatusChip = ({ status, label }: { status: string; label?: string }) => <Chip tone={TONES[status] ?? 'neutral'}>{label ?? status.replace(/_/g, ' ')}</Chip>;

/* ---------- surfaces ---------- */
export function Panel({ title, hint, actions, children, flush, className = '', sunk, glass }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string; sunk?: boolean; glass?: boolean }) {
  return (
    <section className={'panel' + (flush ? ' flush' : '') + (sunk ? ' sunk' : '') + (glass ? ' glass' : '') + ' ' + className}>
      {(title || actions) && (
        <header className="panel-head">
          <div>{title && <h2>{title}</h2>}{hint && <div className="hint">{hint}</div>}</div>
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Metric({ label, value, num, foot, icon, to, onClick, delta }: { label: string; value?: ReactNode; /** a real number the card animates between: counts up once on first view, then glides to each new value */ num?: { value: number; format: NumFormat }; foot?: ReactNode; icon?: ReactNode; to?: string; onClick?: () => void; delta?: { text: string; up: boolean } }) {
  const path = useLocation().pathname;
  const inner = (
    <>
      <span className="label">{icon}{label}</span>
      <span className="value">{num ? <AnimatedNumber id={path + ':' + label} value={num.value} format={num.format} /> : value}</span>
      {(foot || delta) && <span className="foot">{delta && <span className={'delta ' + (delta.up ? 'up' : 'down')}>{delta.up ? '▲' : '▼'} {delta.text}</span>}{foot}</span>}
    </>
  );
  if (to) return <Link to={to} className="panel metric">{inner}</Link>;
  if (onClick) return <button type="button" className="panel metric" onClick={onClick}>{inner}</button>;
  return <div className="panel metric">{inner}</div>;
}

export function PageHeader({ title, sub, actions, crumbs }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumbs?: Array<{ label: string; to?: string }> }) {
  return (
    <motion.header className="page-head" variants={item}>
      <div>
        {crumbs && <nav className="crumbs" aria-label="Breadcrumb">{crumbs.map((c, i) => <span key={c.label} style={{ display: 'contents' }}>{i > 0 && <span aria-hidden>/</span>}{c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}</span>)}</nav>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </motion.header>
  );
}

/** A route's content: stable shell, then one coherent group of children easing in. */
export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <motion.div className="page" data-width={narrow ? 'narrow' : undefined} variants={group} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
/**
 * A section of a page. Blocks that start inside the first screen enter with the page's staged
 * sequence; blocks that start below it wait for a shared observer and reveal once as they arrive.
 * `glass` gives a block the richer panel entrance (edge, rise, blur clearing) — use it sparingly.
 */
export function Block({ children, className = '', glass }: { children: ReactNode; className?: string; glass?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [late, setLate] = useState(false);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight - 48) setLate(true);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!late || !el) return;
    return observeReveal(el, () => { el.dataset.in = 'true'; });
  }, [late]);
  if (late) return <div ref={ref} className={'reveal ' + className} data-glass={glass ? '' : undefined}>{children}</div>;
  return <motion.div ref={ref} variants={glass && !reduce ? glassItem : item} className={(glass ? 'glass-enter ' : '') + className}>{children}</motion.div>;
}

export function Empty({ title, children, art, action }: { title: string; children?: ReactNode; art?: ReactNode; action?: ReactNode }) {
  return <div className="empty">{art}<h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'bad' | 'ok' | 'wine'; title?: string; children: ReactNode }) {
  return <div className="notice" data-tone={tone} role={tone === 'bad' ? 'alert' : 'note'}><Info aria-hidden /><div>{title && <strong>{title}. </strong>}{children}</div></div>;
}

/* ---------- form controls ---------- */
export function Field({ label, help, error, children, className = '' }: { label: string; help?: ReactNode; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={'field ' + className} data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <div className="err" role="alert">{error}</div> : help ? <div className="help">{help}</div> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...p }, ref) { return <input ref={ref} className={'input ' + className} {...p} />; });
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', ...p }, ref) { return <select ref={ref} className={'select ' + className} {...p} />; });
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />;

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => { onChange(e.target.checked); playUiConfirm(); }} aria-label={label} />
      <span className="track" aria-hidden />
    </label>
  );
}
export function SettingRow({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return <div className="setting-row"><div><div className="t">{title}</div>{desc && <div className="d">{desc}</div>}</div>{children}</div>;
}

export const Avatar = ({ name }: { name: string }) => <span className="avatar" aria-hidden>{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>;

export function KV({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="kv">{rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; n?: number }>; label: string }) {
  return (
    <div className="filter-chips" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" className="fchip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}{o.n !== undefined && <span className="n">{o.n}</span>}</button>)}
    </div>
  );
}

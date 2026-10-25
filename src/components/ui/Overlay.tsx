import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { dur, ease } from '@/animations/motion';
import { Button } from './primitives';
import { playUiError } from '@/lib/sound';
import { lockScroll } from '@/lib/scrollLock';

/** Focus trap + Escape + scroll lock + focus restore shared by dialogs and side panels. */
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // callers pass a fresh arrow every render; keeping it in a ref stops the effect (and its focus handling) re-running on every keystroke
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button:not([data-close])') ?? ref.current;
    window.setTimeout(() => first?.focus({ preventScroll: true }), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); unlock(); prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  return ref;
}

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useModal(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="s" className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.panel }} />
          <motion.div key="d" ref={ref} className={'dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
            initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.99 }} transition={{ duration: dur.panel, ease }}>
            <div className="dialog-head"><h2>{title}</h2><Button variant="ghost" size="sm" icon aria-label="Close" data-close onClick={onClose}><X /></Button></div>
            <div className="dialog-body">{children}</div>
            {footer && <div className="dialog-foot">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function SidePanel({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  const ref = useModal(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="s" className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.panel }} />
          <motion.aside key="p" ref={ref} className="side" role="dialog" aria-modal="true" aria-label="Details" tabIndex={-1}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: dur.panel, ease }}>
            <div className="side-head"><div><h2>{title}</h2>{sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}</div><Button variant="ghost" size="sm" icon aria-label="Close details" data-close onClick={onClose}><X /></Button></div>
            <div className="side-body">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} data-autofocus onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}>
      <div className="muted" style={{ paddingBottom: 6 }}>{children}</div>
    </Dialog>
  );
}

/* ---------- toasts ---------- */
interface Toast { id: number; tone: 'ok' | 'bad'; text: string }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'bad') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random();
    if (tone === 'bad') playUiError();
    setItems((x) => [...x.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} className="toast" data-tone={t.tone} layout initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: dur.menu, ease }}>
              {t.tone === 'ok' ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}<span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

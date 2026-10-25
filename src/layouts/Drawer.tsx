import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { ChevronDown, LogOut, Settings, X, ArrowRight } from 'lucide-react';
import { tone, trialLine } from '@/features/trial/TrialPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isActive, type NavItem } from '@/app/nav';
import { ROLE_LABEL } from '@/app/permissions';
import { SikickLogo } from '@/components/brand';
import { Avatar } from '@/components/ui/primitives';
import { dur, ease, stagger } from '@/animations/motion';
import { useAuth, useCommands, useIms, useTrial } from '@/services';
import { visibleNav } from './TopNav';
import { lockScroll } from '@/lib/scrollLock';
import type { Role } from '@/services/contracts/types';

const panel = (reduce: boolean): Variants => ({
  hidden: { x: '-100%' },
  show: { x: 0, transition: { duration: dur.drawer, ease, when: 'beforeChildren', staggerChildren: reduce ? 0 : stagger, delayChildren: reduce ? 0 : 0.06 } },
  exit: { x: '-100%', transition: { duration: dur.drawer - 0.04, ease } },
});
const row = (reduce: boolean): Variants => ({ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: reduce ? 0.1 : dur.panel, ease } }, exit: { opacity: 1 } });

/** Left drawer for phones and tablets: backdrop fades, panel slides, groups stagger in. */
export function Drawer({ open, onClose, returnFocusTo, focusGroup }: { open: boolean; onClose: () => void; returnFocusTo: React.RefObject<HTMLElement | null>; focusGroup?: string | null }) {
  const s = useIms();
  const cmd = useCommands();
  const auth = useAuth();
  const trial = useTrial();
  const nav = useNavigate();
  const loc = useLocation();
  const items = visibleNav(s.role);
  const ref = useRef<HTMLElement>(null);
  const [exp, setExp] = useState<string | null>(null);
  const first = useRef(true);
  const reduce = !!useReducedMotion();
  const panelV = panel(reduce);
  const rowV = row(reduce);

  useEffect(() => { if (open) setExp(focusGroup ?? items.find((i) => isActive(i, loc.pathname) && i.groups)?.id ?? null);  }, [open]);
  useEffect(() => { if (!first.current) onClose(); first.current = false; /* close on navigation */  }, [loc.pathname]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true }), 80);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select'));
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', key);
    const rf = returnFocusTo.current;
    return () => { document.removeEventListener('keydown', key); unlock(); rf?.focus({ preventScroll: true }); };
  }, [open, onClose, returnFocusTo]);

  const pos = items.find((i) => i.emphasis);
  const me = { admin: 'Ameen Ali', manager: 'Farah Siddiqui', warehouse_staff: 'Dev Kumar', pos_operator: 'Priya Sharma' }[s.role];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.drawer, ease }} />
          <motion.aside key="panel" id="app-drawer" ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Navigation" variants={panelV} initial="hidden" animate="show" exit="exit">
            <motion.div className="drawer-head" variants={rowV}>
              <SikickLogo height={30} />
              <button type="button" className="icon-btn" data-close aria-label="Close navigation" onClick={onClose}><X /></button>
            </motion.div>
            <div className="drawer-scroll">
              {pos && (
                <motion.div variants={rowV}>
                  <Link to="/pos" className="drawer-pos" aria-current={loc.pathname === '/pos' ? 'page' : undefined}>
                    <span><pos.icon aria-hidden style={{ display: 'inline', verticalAlign: '-4px', marginRight: 8 }} />Point of sale<small>Open the till · Till 2</small></span><ArrowRight aria-hidden />
                  </Link>
                </motion.div>
              )}
              {items.filter((i) => !i.emphasis).map((n: NavItem) => {
                const act = isActive(n, loc.pathname);
                if (!n.groups) {
                  return <motion.div key={n.id} variants={rowV}><Link to={n.to!} className="dlink" aria-current={act ? 'page' : undefined}><n.icon className="ic" aria-hidden />{n.label}</Link></motion.div>;
                }
                const isOpen = exp === n.id;
                return (
                  <motion.div key={n.id} className="dgroup" variants={rowV}>
                    <button type="button" className="dgroup-btn" aria-expanded={isOpen} aria-controls={'dsub-' + n.id} data-active={act} onClick={() => setExp(isOpen ? null : n.id)}>
                      <n.icon className="ic" aria-hidden />{n.label}<ChevronDown className="chev" aria-hidden />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div id={'dsub-' + n.id} className="dsub" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: dur.menu + 0.04, ease }}>
                          <div className="dsub-in">
                            {n.groups.flatMap((g) => g.items).map((l, i) => <motion.div key={l.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: dur.menu, ease, delay: reduce ? 0 : 0.06 + i * 0.03 }}><Link to={l.to} aria-current={loc.pathname === l.to ? 'page' : undefined}>{l.label}{l.desc && <small>{l.desc}</small>}</Link></motion.div>)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
            <motion.div className="drawer-foot" variants={rowV}>
              <Avatar name={me} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{me}</div>
                <select className="select" style={{ minHeight: 30, marginTop: 4, fontSize: 'var(--fs-sm)' }} aria-label="Preview as role" value={s.role} onChange={(e) => cmd.setRole(e.target.value as Role)}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <ThemeToggle />
              <div className="drawer-acct">
                <Link className="trial-pill" data-tone={(tone(trial) === 'wine' ? undefined : tone(trial))} to="/trial-ended">{trialLine(trial)}</Link>
                <Link className="btn btn-sm" to="/settings"><Settings aria-hidden />Settings</Link>
                <button type="button" className="btn btn-sm" onClick={async () => { onClose(); await auth.signOut(); nav('/login'); }}><LogOut aria-hidden />Sign out</button>
              </div>
            </motion.div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

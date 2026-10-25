import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ChevronDown, Clock, LogOut, Menu as MenuIcon, RotateCcw, Search, Store, Check, Plus, Volume2, VolumeX } from 'lucide-react';
import { ThemePicker } from '@/components/ThemePicker';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NAV, isActive, type NavItem } from '@/app/nav';
import { ROLE_LABEL, canAccess } from '@/app/permissions';
import { SikickLogo } from '@/components/brand';
import { Avatar } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { menu as menuVariants, dur, ease } from '@/animations/motion';
import { useAuth, useCommands, useIms, useTrial } from '@/services';
import { trialDate, trialLine } from '@/features/trial/TrialPanel';
import { alerts } from '@/services/selectors';
import { WORKSPACE } from '@/data/fixtures/seed';
import { configureSound, playNavigate, playUiConfirm } from '@/lib/sound';
import type { Role } from '@/services/contracts/types';

/** Menus close on outside press and Escape, and focus returns to the trigger. */
function usePopover(onClose: () => void, open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); (ref.current?.querySelector('button') as HTMLElement | null)?.focus(); return; }
      if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !ref.current) return;
      const at = document.activeElement as HTMLElement | null;
      if (!at || !ref.current.contains(at) || at.tagName === 'SELECT' || at.tagName === 'INPUT') return;
      const list = Array.from(ref.current.querySelectorAll<HTMLElement>('.menu a[href], .menu button, .menu select'));
      if (!list.length) return;
      e.preventDefault();
      const i = list.indexOf(at);
      list[i < 0 ? (e.key === 'ArrowDown' ? 0 : list.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open, onClose, ref]);
}

export function visibleNav(role: Role): NavItem[] {
  return NAV.map((n) => {
    if (n.to) return canAccess(role, n.to) ? n : null;
    const groups = (n.groups ?? []).map((g) => ({ ...g, items: g.items.filter((i) => canAccess(role, i.to)) })).filter((g) => g.items.length);
    return groups.length ? { ...n, groups } : null;
  }).filter((x): x is NavItem => !!x);
}

function NavMenu({ item, open, onToggle, onClose, onHover, active }: { item: NavItem; open: boolean; onToggle: () => void; onClose: () => void; onHover: () => void; active: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const loc = useLocation();
  usePopover(onClose, open, ref);
  const Icon = item.icon;
  const cols = (item.groups?.length ?? 0) > 2 ? 2 : 1;
  return (
    <li className="nav-item" ref={ref}>
      <button type="button" className="nav-btn" aria-haspopup="menu" aria-expanded={open} data-open={open} data-active={active} onClick={onToggle} onMouseEnter={onHover}>
        <Icon className="ic" aria-hidden /><span>{item.label}</span><ChevronDown className="chev" aria-hidden />
        <AnimatePresence initial={false}>{active && <motion.span layoutId="nav-ind" className="nav-ind" exit={{ opacity: 0 }} transition={{ duration: dur.tab, ease }} />}</AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu" role="menu" aria-label={item.label} data-cols={cols} data-align={item.id === 'more' || item.id === 'siborg' ? 'end' : undefined}
            variants={menuVariants} initial="hidden" animate="show" exit="exit">
            {item.groups!.map((g) => (
              <div className="menu-group" key={g.label}>
                <div className="menu-label">{g.label}</div>
                {g.items.map((l) => {
                  const LI = l.icon;
                  return (
                    <Link key={l.to} to={l.to} role="menuitem" className="menu-link" aria-current={loc.pathname === l.to ? 'page' : undefined} onClick={() => { if (loc.pathname !== l.to) playNavigate(); onClose(); }}>
                      <span className="mi"><LI aria-hidden /></span>
                      <span><b>{l.label}</b>{l.desc && <small>{l.desc}</small>}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Pop({ trigger, children, align = 'end', label }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'end' | 'start'; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePopover(() => setOpen(false), open, ref);
  return (
    <div className="pop" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && <motion.div className="menu" role="dialog" aria-label={label} data-align={align === 'end' ? 'end' : undefined} variants={menuVariants} initial="hidden" animate="show" exit="exit" style={{ minWidth: 300, ...(align === 'start' ? { left: 0, translate: '0 0' } : {}) }}>{children(() => setOpen(false))}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

export function TopNav({ onOpenDrawer, onOpenSearch, menuButtonRef }: { onOpenDrawer: () => void; onOpenSearch: () => void; menuButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  const s = useIms();
  const cmd = useCommands();
  const auth = useAuth();
  const trial = useTrial();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);
  // header glass is driven by scroll depth (0 to 1 over the first 40 px) through one CSS variable, with no React re-render
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      const el = bar.current;
      if (!el) return;
      const p = Math.min(1, Math.max(0, window.scrollY / 40));
      el.style.setProperty('--sp', p.toFixed(3));
      el.dataset.scrolled = String(p > 0);
    };
    const f = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', f, { passive: true });
    return () => { window.removeEventListener('scroll', f); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const toggleSound = () => { const next = { ...s.sound, enabled: !s.sound.enabled }; configureSound(next); cmd.setSound({ enabled: next.enabled }); if (next.enabled) playUiConfirm(); toast(next.enabled ? 'Sound is on. It follows drawers, the till, SiBorg and urgent alerts.' : 'Sound is off.'); };
  const items = visibleNav(s.role);
  const unread = alerts(s).filter((a) => !a.acknowledged);
  const me = { admin: 'Ameen Ali', manager: 'Farah Siddiqui', warehouse_staff: 'Dev Kumar', pos_operator: 'Priya Sharma' }[s.role];

  useEffect(() => setOpen(null), [loc.pathname]);

  return (
    <header className="topbar" ref={bar} data-scrolled="false">
      <div className="topbar-in">
        <button type="button" ref={menuButtonRef} className="icon-btn menu-btn" aria-label="Open navigation" aria-controls="app-drawer" onClick={onOpenDrawer}><MenuIcon /></button>
        <div className="brand">
          <Link to="/dashboard" aria-label="Sikick dashboard"><SikickLogo height={30} /></Link>
          <Pop label="Workspace" align="start" trigger={({ open: o, toggle }) => (
            <button type="button" className="ws" aria-haspopup="dialog" aria-expanded={o} onClick={toggle}>
              <span className="mono-badge" aria-hidden>M</span><span className="t">{s.account.workspace.name}</span><ChevronDown aria-hidden />
            </button>
          )}>
            {(close) => (
              <div>
                <div className="menu-label">Shops in this workspace</div>
                <button type="button" className="menu-link" style={{ width: '100%', textAlign: 'left' }} onClick={close}><span className="mi"><Store aria-hidden /></span><span style={{ flex: 1 }}><b>{WORKSPACE.name}</b><small>{WORKSPACE.location} · {WORKSPACE.till}</small></span><Check size={15} color="var(--wine)" /></button>
                <div className="menu-sep" />
                <button type="button" className="menu-link" style={{ width: '100%', textAlign: 'left' }} onClick={() => { close(); toast('Adding a shop uses POST /shops. Not connected in this prototype.', 'ok'); }}><span className="mi"><Plus aria-hidden /></span><span><b>Add a shop</b><small>Prototype only, nothing is created</small></span></button>
              </div>
            )}
          </Pop>
        </div>

        <nav aria-label="Primary" className="nav">
          <ul style={{ display: 'contents' }}>
            {items.map((n) => {
              if (n.emphasis) {
                return <li key={n.id}><NavLink to={n.to!} className="nav-pos" aria-label="Point of sale" onClick={() => { if (loc.pathname !== n.to) playNavigate(); }}><n.icon aria-hidden />POS</NavLink></li>;
              }
              if (n.to) {
                const act = isActive(n, loc.pathname);
                return (
                  <li key={n.id} className="nav-item">
                    <Link to={n.to} className="nav-btn" data-active={act} aria-current={act ? 'page' : undefined} onMouseEnter={() => setOpen(null)} onClick={() => { if (!act) playNavigate(); }}>
                      <n.icon className="ic" aria-hidden /><span>{n.label}</span>
                      <AnimatePresence initial={false}>{act && <motion.span layoutId="nav-ind" className="nav-ind" exit={{ opacity: 0 }} transition={{ duration: dur.tab, ease }} />}</AnimatePresence>
                    </Link>
                  </li>
                );
              }
              return <NavMenu key={n.id} item={n} open={open === n.id} active={isActive(n, loc.pathname)} onToggle={() => setOpen(open === n.id ? null : n.id)} onClose={() => setOpen((c) => (c === n.id ? null : c))} onHover={() => { if (open && open !== n.id) setOpen(n.id); }} />;
            })}
          </ul>
        </nav>

        <div className="tools">
          <button type="button" className="search-btn" aria-label="Search" onClick={onOpenSearch}><Search aria-hidden /><span>Search items, orders…</span><kbd>Ctrl K</kbd></button>
          <button type="button" className="icon-btn" aria-label={s.sound.enabled ? 'Mute sound' : 'Turn sound on'} aria-pressed={s.sound.enabled} onClick={toggleSound}>{s.sound.enabled ? <Volume2 /> : <VolumeX />}</button>
          <ThemeToggle className="icon-btn theme-top" />
          <Pop label="Alerts" trigger={({ open: o, toggle }) => (
            <button type="button" className="icon-btn" aria-label={'Alerts, ' + unread.length + ' unread'} aria-expanded={o} aria-haspopup="dialog" onClick={toggle}><Bell />{unread.length > 0 && <span className="badge">{unread.length}</span>}</button>
          )}>
            {(close) => (
              <div style={{ minWidth: 340 }}>
                <div className="menu-label">Needs attention</div>
                {unread.slice(0, 5).map((a) => (
                  <button key={a.id} type="button" className="menu-link" style={{ width: '100%', textAlign: 'left' }} onClick={() => { close(); nav('/alerts'); }}>
                    <span className="mi" style={{ background: a.severity === 'critical' || a.severity === 'high' ? 'var(--bad-soft)' : 'var(--warn-soft)', color: a.severity === 'critical' || a.severity === 'high' ? 'var(--bad)' : 'var(--warn)' }}><Bell aria-hidden /></span>
                    <span><b>{a.title}</b><small>{a.detail.slice(0, 70)}{a.detail.length > 70 ? '…' : ''}</small></span>
                  </button>
                ))}
                <div className="menu-sep" />
                <Link className="menu-link" to="/alerts" onClick={close}><span><b>Open all alerts</b></span></Link>
              </div>
            )}
          </Pop>
          <Pop label="Account" trigger={({ open: o, toggle }) => (
            <button type="button" className="me" aria-label="Account menu" aria-expanded={o} aria-haspopup="dialog" onClick={toggle}><Avatar name={me} /><ChevronDown size={13} aria-hidden /></button>
          )}>
            {(close) => (
              <div>
                <div className="list-row" style={{ padding: '8px 10px' }}><Avatar name={me} /><div className="grow"><div className="t">{me}</div><div className="d">{ROLE_LABEL[s.role]} · {s.account.workspace.name}</div></div></div>
                <Link className="menu-link" to="/trial-ended" onClick={close}><span className="mi"><Clock aria-hidden /></span><span><b>{trialLine(trial)}</b><small>{trial.paid ? 'Plan details' : trial.readOnly ? 'See what happens next' : 'Ends ' + trialDate(trial.endsAt) + ' · no card needed'}</small></span></Link>
                <div className="menu-sep" />
                <div className="menu-label">Preview as role</div>
                <div style={{ padding: '2px 10px 8px' }}>
                  <select className="select" aria-label="Preview as role" value={s.role} onChange={(e) => { cmd.setRole(e.target.value as Role); }}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 6 }}>Navigation and routes follow the source role gates.</div>
                </div>
                <div className="menu-sep" />
                <div className="menu-label">Appearance</div>
                <div style={{ padding: '2px 10px 8px' }}><ThemePicker /></div>
                <button type="button" className="menu-link" style={{ width: '100%', textAlign: 'left' }} onClick={() => { cmd.resetDemo(); toast('Local data restored to its starting state.'); close(); }}>
                  <span className="mi"><RotateCcw aria-hidden /></span><span><b>Reset local data</b><small>Undo every change made in this prototype</small></span>
                </button>
                <div className="menu-sep" />
                <button type="button" className="menu-link" style={{ width: '100%', textAlign: 'left' }} onClick={async () => { close(); await auth.signOut(); nav('/login'); }}>
                  <span className="mi"><LogOut aria-hidden /></span><span><b>Sign out</b><small>{s.account.session.email}</small></span>
                </button>
              </div>
            )}
          </Pop>
        </div>
      </div>
    </header>
  );
}

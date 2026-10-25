import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { canAccess, ROLE_LABEL, allowedRoles } from '@/app/permissions';
import { ToastProvider, useToast } from '@/components/ui/Overlay';
import { ease } from '@/animations/motion';
import { useIms, useTrial } from '@/services';
import { configureSound, playDrawerClose, playDrawerOpen, playOperationalWarning, unlockSound } from '@/lib/sound';
import { alerts } from '@/services/selectors';
import { TopNav } from './TopNav';
import { Drawer } from './Drawer';
import { CommandSearch } from './CommandSearch';
import { Assistant } from './Assistant';
import { BottomNav } from './BottomNav';
import { Rail } from './Rail';
import { TrialNotice } from '@/features/trial/TrialNotice';
import { PausedGate } from '@/features/trial/PausedGate';
import { DevPanel } from '@/features/auth/DevPanel';

function Gate({ path }: { path: string }) {
  const s = useIms();
  const roles = allowedRoles(path);
  return (
    <div className="page" data-width="narrow">
      <div className="panel panel-pad empty">
        <Lock size={26} color="var(--wine)" aria-hidden />
        <h3>This page is not open to your role</h3>
        <p>You are previewing as {ROLE_LABEL[s.role]}. It is available to {roles.map((r) => ROLE_LABEL[r]).join(', ')}.</p>
        <Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link>
      </div>
    </div>
  );
}

/** Scroll positions by history entry, so back/forward returns to where the page was and new routes start at the top. */
const scrolls = new Map<string, number>();
function ScrollOnEnter({ locKey, restore }: { locKey: string; restore: boolean }) {
  useLayoutEffect(() => {
    const want = restore ? scrolls.get(locKey) ?? 0 : 0;
    window.scrollTo(0, want);
    if (!want) return;
    // content may still be settling; try again once it has height
    const t = window.setTimeout(() => { if (Math.abs(window.scrollY - want) > 4) window.scrollTo(0, want); }, 260);
    return () => window.clearTimeout(t);
  }, [locKey, restore]);
  return null;
}

/** A refused write (the workspace is read-only) is always said out loud, once per refusal. */
function BlockedWatcher() {
  const s = useIms();
  const toast = useToast();
  const seen = useRef(s.blocked.n);
  useEffect(() => { if (s.blocked.n !== seen.current) { seen.current = s.blocked.n; toast(s.blocked.message, 'bad'); } }, [s.blocked, toast]);
  return null;
}

export function AppShell() {
  const s = useIms();
  const loc = useLocation();
  const navType = useNavigationType();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const trial = useTrial();
  const searchBtn = useRef<HTMLElement | null>(null);

  useEffect(() => { configureSound(s.sound); }, [s.sound]);
  // browsers only allow audio after a gesture: the first press/key after the person has sound on wakes the context
  useEffect(() => {
    if (!s.sound.enabled) return;
    const wake = () => unlockSound();
    window.addEventListener('pointerdown', wake, { capture: true, once: true });
    window.addEventListener('keydown', wake, { capture: true, once: true });
    return () => { window.removeEventListener('pointerdown', wake, true); window.removeEventListener('keydown', wake, true); };
  }, [s.sound.enabled]);

  // one restrained cue when a NEW critical/high alert appears; the first pass only records what is already there
  const knownAlerts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const urgent = alerts(s).filter((a) => !a.acknowledged && (a.severity === 'critical' || a.severity === 'high')).map((a) => a.id);
    const known = knownAlerts.current;
    knownAlerts.current = new Set(urgent);
    if (known && urgent.some((id) => !known.has(id))) playOperationalWarning();
  }, [s]);

  useEffect(() => {
    let raf = 0;
    const save = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => scrolls.set(loc.key, window.scrollY)); };
    window.addEventListener('scroll', save, { passive: true });
    return () => { window.removeEventListener('scroll', save); cancelAnimationFrame(raf); };
  }, [loc.key]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchBtn.current = document.activeElement as HTMLElement; setSearch(true); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const drawerOpen = useRef(false);
  drawerOpen.current = drawer;
  const openDrawer = useCallback((group?: string) => { if (!drawerOpen.current) { playDrawerOpen(); opener.current = document.activeElement as HTMLElement | null; } setFocusGroup(group ?? null); setDrawer(true); }, []);
  const closeDrawer = useCallback(() => { if (drawerOpen.current) { drawerOpen.current = false; playDrawerClose(); } setDrawer(false); }, []);
  const closeSearch = useCallback(() => setSearch(false), []);
  const allowed = canAccess(s.role, loc.pathname);
  const path = loc.pathname;
  const archivedBlock = trial.archived && !['/trial-ended', '/settings/billing'].includes(path);
  const tillPaused = trial.readOnly && (path === '/pos' || path.startsWith('/pos/'));

  if (!s.account.session.authenticated) return <Navigate to={'/login?next=' + encodeURIComponent(loc.pathname + loc.search)} replace />;

  return (
    <ToastProvider>
      <BlockedWatcher />
      <a href="#main" className="sr-only">Skip to content</a>
      <TopNav onOpenDrawer={() => openDrawer()} onOpenSearch={() => { searchBtn.current = document.activeElement as HTMLElement; setSearch(true); }} menuButtonRef={menuBtn} />
      <TrialNotice />
      <Drawer open={drawer} onClose={closeDrawer} returnFocusTo={opener} focusGroup={focusGroup} />
      <Assistant />
      <Rail onOpenAll={openDrawer} />
      <BottomNav drawerOpen={drawer} onOpenMenu={() => openDrawer()} />
      <CommandSearch open={search} onClose={closeSearch} returnFocusTo={searchBtn} />
      <main id="main" className="app-main" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={loc.pathname} initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -3, transition: { duration: 0.07, ease } }}>
            <ScrollOnEnter locKey={loc.key} restore={navType === 'POP'} />
            {!allowed ? <Gate path={loc.pathname} /> : archivedBlock ? <PausedGate what="This workspace" /> : tillPaused ? <PausedGate what="The till" /> : <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>
      <DevPanel />
    </ToastProvider>
  );
}


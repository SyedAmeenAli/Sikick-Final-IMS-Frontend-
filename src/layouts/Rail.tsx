import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronsLeft, ChevronsRight, LayoutGrid } from 'lucide-react';
import { isActive } from '@/app/nav';
import { dur, ease } from '@/animations/motion';
import { useIms } from '@/services';
import { visibleNav } from './TopNav';

const KEY = 'sikick.rail.v1';
const read = () => { try { return window.localStorage.getItem(KEY) === 'wide'; } catch { return false; } };

/**
 * Tablet landscape only (900 to 1180 px wide, landscape; CSS hides it everywhere else). A narrow icon rail that can open to
 * labels. It is a convenience for the main modules: every route is still reachable in the full drawer ("All pages"),
 * which phones and portrait tablets open as an overlay instead.
 */
export function Rail({ onOpenAll }: { onOpenAll: (group?: string) => void }) {
  const s = useIms();
  const { pathname } = useLocation();
  const [wide, setWide] = useState(read);
  const [open, setOpen] = useState<string | null>(null);
  const items = visibleNav(s.role).filter((i) => !i.emphasis);
  const pos = visibleNav(s.role).find((i) => i.emphasis);

  useEffect(() => {
    document.documentElement.dataset.rail = wide ? 'wide' : 'narrow';
    try { window.localStorage.setItem(KEY, wide ? 'wide' : 'narrow'); } catch { /* ignore */ }
  }, [wide]);
  useEffect(() => { if (!wide) setOpen(null); }, [wide]);

  return (
    <aside className="rail" aria-label="Main modules" data-wide={wide}>
      {pos && <NavLink to={pos.to!} className="rail-pos" aria-label="Point of sale" title="POS"><pos.icon aria-hidden /><span className="rl">POS</span></NavLink>}
      <ul className="rail-list">
        {items.map((n) => {
          const act = isActive(n, pathname);
          const Icon = n.icon;
          if (n.to) return <li key={n.id}><NavLink to={n.to} className="rail-item" aria-current={act ? 'page' : undefined} title={n.label}><Icon aria-hidden /><span className="rl">{n.label}</span></NavLink></li>;
          const isOpen = open === n.id && wide;
          return (
            <li key={n.id}>
              <button type="button" className="rail-item" data-active={act} aria-expanded={wide ? isOpen : undefined} aria-haspopup={wide ? undefined : 'dialog'} title={n.label}
                onClick={() => (wide ? setOpen(isOpen ? null : n.id) : onOpenAll(n.id))}>
                <Icon aria-hidden /><span className="rl">{n.label}</span><ChevronDown className="rc" aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div className="rail-sub" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: dur.menu, ease }}>
                    {n.groups!.flatMap((g) => g.items).map((l) => <Link key={l.to} to={l.to} aria-current={pathname === l.to ? 'page' : undefined}>{l.label}</Link>)}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <div className="rail-foot">
        <button type="button" className="rail-item" onClick={() => onOpenAll()} title="All pages"><LayoutGrid aria-hidden /><span className="rl">All pages</span></button>
        <button type="button" className="rail-item" aria-pressed={wide} aria-label={wide ? 'Collapse the side rail' : 'Expand the side rail'} onClick={() => setWide((w) => !w)} title={wide ? 'Collapse' : 'Expand'}>{wide ? <ChevronsLeft aria-hidden /> : <ChevronsRight aria-hidden />}<span className="rl">Collapse</span></button>
      </div>
    </aside>
  );
}

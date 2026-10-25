import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutDashboard, Boxes, Store, ShoppingCart, Menu as MenuIcon, type LucideIcon } from 'lucide-react';
import { NAV, isActive } from '@/app/nav';
import { canAccess } from '@/app/permissions';
import { dur, ease } from '@/animations/motion';
import { useIms } from '@/services';

interface Slot { id: string; label: string; to: string; icon: LucideIcon }
/** Five quick destinations. Everything else lives in the drawer behind "More". POS sits in the middle and is the one filled control. */
const SLOTS: Slot[] = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', to: '/inventory', icon: Boxes },
  { id: 'pos', label: 'POS', to: '/pos', icon: Store },
  { id: 'sales', label: 'Sales', to: '/orders', icon: ShoppingCart },
];

/** Phones and tablets. Hidden from 1181 px up, where the top bar carries all of this. */
export function BottomNav({ drawerOpen, onOpenMenu }: { drawerOpen: boolean; onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const s = useIms();
  const slots = useMemo(() => SLOTS.filter((x) => canAccess(s.role, x.to)), [s.role]);
  const current = slots.find((x) => { const n = NAV.find((i) => i.id === x.id); return n ? isActive(n, pathname) : pathname.startsWith(x.to); });
  const elsewhere = !current;     // somewhere that is not one of the four: the menu is where you are
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      <ul>
        {slots.map((x) => {
          const act = current?.id === x.id;
          const Icon = x.icon;
          return (
            <li key={x.id} data-pos={x.id === 'pos' ? '' : undefined}>
              <NavLink to={x.to} className="bn-item" aria-current={act ? 'page' : undefined} onClick={(e) => { if (act && pathname === x.to) e.preventDefault(); }}>
                {act && <motion.span layoutId="bn-ind" className="bn-ind" transition={{ duration: dur.tab, ease }} />}
                <span className="bn-ic"><Icon aria-hidden /></span>
                <span className="bn-lb">{x.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li>
          <button type="button" className="bn-item" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="app-drawer" data-rest={elsewhere && !drawerOpen ? '' : undefined} onClick={onOpenMenu}>
            {(drawerOpen || elsewhere) && <motion.span layoutId="bn-ind" className="bn-ind" transition={{ duration: dur.tab, ease }} />}
            <span className="bn-ic"><MenuIcon aria-hidden /></span>
            <span className="bn-lb">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

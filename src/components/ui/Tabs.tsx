import { useId, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { dur, ease } from '@/animations/motion';

export interface TabDef<T extends string = string> { id: T; label: string; count?: number; icon?: ReactNode }

/** State tabs. The wine underline travels between tabs rather than jumping. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<TabDef<T>>; value: T; onChange: (id: T) => void; label: string }) {
  const uid = useId();
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" id={uid + t.id} aria-selected={value === t.id} className="tab" onClick={() => onChange(t.id)}>
          {t.icon}{t.label}{t.count !== undefined && <span className="n">{t.count}</span>}
          {value === t.id && <motion.span layoutId={'tabbar-' + uid} className="tab-bar" transition={{ duration: dur.tab, ease }} />}
        </button>
      ))}
    </div>
  );
}

/** Route tabs (settings sub-navigation and similar): real links, current page marked. */
export function RouteTabs({ tabs, label }: { tabs: Array<{ to: string; label: string; end?: boolean; icon?: ReactNode }>; label: string }) {
  const uid = useId();
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab">
          {({ isActive }) => (
            <>
              {t.icon}{t.label}
              {isActive && <motion.span layoutId={'rtabbar-' + uid} className="tab-bar" transition={{ duration: dur.tab, ease }} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

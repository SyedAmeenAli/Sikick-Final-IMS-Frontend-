import { Moon, Sun } from 'lucide-react';
import { playUiConfirm } from '@/lib/sound';
import { useCommands, useIms } from '@/services';

/** Sun and moon cross-fade and turn a quarter-turn together with the token transition (CSS, driven by data-theme). */
export function ThemeToggle({ className = 'icon-btn', label = true }: { className?: string; label?: boolean }) {
  const s = useIms();
  const cmd = useCommands();
  const dark = s.theme === 'dark';
  return (
    <button type="button" className={className + ' theme-toggle'} aria-pressed={dark} aria-label={label ? (dark ? 'Switch to light appearance' : 'Switch to dark appearance') : undefined}
      onClick={() => { cmd.setThemePref(dark ? 'light' : 'dark'); playUiConfirm(); }}>
      <span className="tt-sun" aria-hidden><Sun /></span>
      <span className="tt-moon" aria-hidden><Moon /></span>
    </button>
  );
}

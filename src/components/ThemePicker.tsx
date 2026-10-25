import { Monitor, Moon, Sun } from 'lucide-react';
import { useCommands, useIms } from '@/services';
import { playUiConfirm } from '@/lib/sound';

/** Light, Dark or System. System follows the device and keeps following it; the other two are an explicit, saved choice. */
export function ThemePicker() {
  const s = useIms();
  const cmd = useCommands();
  const opts = [{ v: 'light', l: 'Light', I: Sun }, { v: 'dark', l: 'Dark', I: Moon }, { v: 'system', l: 'System', I: Monitor }] as const;
  return (
    <div className="theme-seg" role="group" aria-label="Appearance">
      {opts.map(({ v, l, I }) => <button key={v} type="button" aria-pressed={s.themePref === v} onClick={() => { cmd.setThemePref(v); playUiConfirm(); }}><I aria-hidden />{l}</button>)}
    </div>
  );
}

import { useLayoutEffect } from 'react';
import { applyTheme } from '@/lib/theme';
import { useCommands, useIms } from '@/services';

/** Mounted once above the router so every route, including sign-in and onboarding, follows the theme. */
export function ThemeSync() {
  const s = useIms();
  const cmd = useCommands();
  useLayoutEffect(() => { applyTheme(s.theme); }, [s.theme]);
  // ?theme=dark|light on a review link applies for this visit without replacing the saved choice
  useLayoutEffect(() => { const t = new URLSearchParams(window.location.search).get('theme'); if (t === 'dark' || t === 'light') cmd.setThemePref(t, false); }, [cmd]);
  return null;
}

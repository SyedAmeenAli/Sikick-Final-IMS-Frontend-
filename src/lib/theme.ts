/**
 * Theme preference: 'light' | 'dark' | 'system'. An explicit choice is kept in this browser and never
 * overwritten by the operating system; 'system' (also the default when nothing was chosen) follows it.
 * The first paint is handled by the inline script in index.html, which reads the same key.
 */
export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';
const KEY = 'sikick.theme.v1';

export function readPref(): ThemePref {
  try { const v = window.localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch { /* storage blocked */ }
  return 'system';
}
export function savePref(p: ThemePref) { try { window.localStorage.setItem(KEY, p); } catch { /* ignore */ } }
export const systemTheme = (): Theme => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const resolveTheme = (p: ThemePref): Theme => (p === 'system' ? systemTheme() : p);

/** Writes the effective theme to the document: token set, native colour scheme (scrollbars, form controls), browser chrome colour. */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.dataset.theme = t;
  root.style.colorScheme = t;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = t === 'dark' ? '#120d10' : '#f4efea';
}

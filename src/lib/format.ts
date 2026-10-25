import { NOW } from '@/data/fixtures/seed';

const d = (iso: string) => new Date(iso);
export const fmtDate = (iso: string) => d(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDay = (iso: string) => d(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => d(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtStamp = (iso: string) => fmtDay(iso) + ', ' + fmtTime(iso);

/** "12 min ago", "Yesterday, 18:05", "3 days ago" measured from the prototype's fixed "now". */
export function ago(iso: string): string {
  const diff = NOW.getTime() - d(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24 && d(iso).getDate() === NOW.getDate()) return hrs + ' h ago';
  const days = Math.floor((new Date(NOW.toDateString()).getTime() - new Date(d(iso).toDateString()).getTime()) / 864e5);
  if (days === 1) return 'Yesterday, ' + fmtTime(iso);
  if (days < 14) return days + ' days ago';
  return fmtDay(iso);
}
export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

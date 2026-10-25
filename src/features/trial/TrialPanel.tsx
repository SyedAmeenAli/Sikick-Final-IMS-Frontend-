import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RETENTION_DAYS, TRIAL_DAYS, type TrialInfo } from '@/services/account';

const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export { fmtDate as trialDate };

export const tone = (t: TrialInfo): 'ok' | 'warn' | 'bad' | 'wine' =>
  t.paid ? 'ok' : t.phase === 'trial-ending' || t.phase === 'readonly' ? 'warn' : t.phase === 'readonly-ending' || t.phase === 'retention-ended' ? 'bad' : 'wine';

/** The one-line status used in menus and bars: "Trial · 9 days left". Reads the shared TrialInfo, never its own clock. */
export function trialLine(t: TrialInfo): string {
  switch (t.phase) {
    case 'active': return 'Active plan';
    case 'trial-new': case 'trial': case 'trial-ending': return 'Trial · ' + t.daysLeft + (t.daysLeft === 1 ? ' day left' : ' days left');
    case 'readonly': case 'readonly-ending': return 'Read-only · ' + t.retentionDaysLeft + (t.retentionDaysLeft === 1 ? ' day to export' : ' days to export');
    case 'retention-ended': return 'Archived';
  }
}

/** Days used, drawn as a ring. The figure inside counts days left (during the trial) or days to export (after it). */
export function TrialRing({ t }: { t: TrialInfo }) {
  const r = 48, c = 2 * Math.PI * r;
  const counting = t.phase === 'retention-ended' ? 0 : t.readOnly ? t.retentionDaysLeft ?? 0 : t.paid ? 0 : t.daysLeft;
  const frac = t.readOnly ? Math.min(1, 1 - (t.retentionDaysLeft ?? 0) / RETENTION_DAYS) : t.progress;
  return (
    <div className="ring" role="img" aria-label={trialLine(t)}>
      <svg viewBox="0 0 112 112" aria-hidden><circle className="bg" cx="56" cy="56" r={r} /><circle className="fg" cx="56" cy="56" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={t.phase === 'retention-ended' ? { stroke: 'var(--bad)' } : undefined} /></svg>
      <div className="mid"><b><AnimatedNumber id="trial:ring" value={counting} format={{ kind: 'int' }} first={700} /></b><small>{t.paid ? 'plan' : t.readOnly ? 'days to export' : counting === 1 ? 'day left' : 'days left'}</small></div>
    </div>
  );
}

/** Day 0, day 14, day 14 + 90: where the workspace is on its three-step path. */
export function TrialTimeline({ t }: { t: TrialInfo }) {
  const state = (i: number) => { const at = t.paid ? 3 : t.archived ? 2 : t.readOnly ? 1 : 0; return i < at ? 'done' : i === at ? 'now' : 'todo'; };
  return (
    <div className="timeline-h" role="list" aria-label="Trial timeline">
      <div role="listitem" data-state={state(0)}><b>Trial runs</b><small>{fmtDate(t.startedAt)} to {fmtDate(t.endsAt)} · {TRIAL_DAYS} days, no card</small></div>
      <div role="listitem" data-state={state(1)}><b>Read-only</b><small>From {fmtDate(t.endsAt)}: view and export everything for {RETENTION_DAYS} days</small></div>
      <div role="listitem" data-state={state(2)}><b>Archived</b><small>{t.retentionEndsAt ? 'From ' + fmtDate(t.retentionEndsAt) : 'After ' + RETENTION_DAYS + ' days read-only'} unless a plan is chosen</small></div>
    </div>
  );
}

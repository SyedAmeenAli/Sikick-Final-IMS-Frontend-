import type { AccountState, TrialPhase } from './contracts/account';

/** The one place trial time is computed. Every screen reads TrialInfo; nothing counts down on its own. */
export const DAY = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 14;
/** read-only, viewable and exportable for this long after the trial ends, before the workspace is archived */
export const RETENTION_DAYS = 90;
export const ENDING_DAYS = 3;
export const RETENTION_WARN_DAYS = 14;

export interface TrialInfo {
  phase: TrialPhase;
  startedAt: Date;
  endsAt: Date;
  /** whole days left in the trial (0 once it has ended) */
  daysLeft: number;
  /** 0..1 of the 14 days used */
  progress: number;
  /** whole days left of the 90-day read-only and export window; null while the trial runs or after a plan */
  retentionDaysLeft: number | null;
  retentionEndsAt: Date | null;
  canWrite: boolean;
  readOnly: boolean;
  archived: boolean;
  paid: boolean;
}

export const accountNow = (a: AccountState, real: number = Date.now()) => real + a.clockShiftMs;

export function trialInfo(a: AccountState, now: number = accountNow(a)): TrialInfo {
  const start = new Date(a.billing.trialStartedAt);
  const end = new Date(a.billing.trialEndsAt);
  const retentionEnds = new Date(end.getTime() + RETENTION_DAYS * DAY);
  const base = { startedAt: start, endsAt: end };
  if (a.billing.status === 'active') {
    return { ...base, phase: 'active', daysLeft: 0, progress: 1, retentionDaysLeft: null, retentionEndsAt: null, canWrite: true, readOnly: false, archived: false, paid: true };
  }
  const total = end.getTime() - start.getTime();
  if (now < end.getTime()) {
    const daysLeft = Math.max(1, Math.ceil((end.getTime() - now) / DAY));
    const phase: TrialPhase = now - start.getTime() < DAY ? 'trial-new' : daysLeft <= ENDING_DAYS ? 'trial-ending' : 'trial';
    return { ...base, phase, daysLeft, progress: Math.min(1, Math.max(0, (now - start.getTime()) / (total || 1))), retentionDaysLeft: null, retentionEndsAt: null, canWrite: true, readOnly: false, archived: false, paid: false };
  }
  const left = Math.max(0, Math.ceil((retentionEnds.getTime() - now) / DAY));
  if (now >= retentionEnds.getTime()) {
    return { ...base, phase: 'retention-ended', daysLeft: 0, progress: 1, retentionDaysLeft: 0, retentionEndsAt: retentionEnds, canWrite: false, readOnly: true, archived: true, paid: false };
  }
  return { ...base, phase: left <= RETENTION_WARN_DAYS ? 'readonly-ending' : 'readonly', daysLeft: 0, progress: 1, retentionDaysLeft: left, retentionEndsAt: retentionEnds, canWrite: false, readOnly: true, archived: false, paid: false };
}

export const SCENARIOS = ['new', 'mid', 'ending', 'expired', 'readonly-ending', 'retention-ended', 'paid'] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Dates for each named state, measured from the real clock so they are reproducible. */
export function scenarioBilling(name: Scenario, now: number = Date.now()): AccountState['billing'] {
  const mk = (startAgoMs: number) => ({ status: 'trial' as const, plan: 'starter' as const, trialStartedAt: new Date(now - startAgoMs).toISOString(), trialEndsAt: new Date(now - startAgoMs + TRIAL_DAYS * DAY).toISOString() });
  switch (name) {
    case 'new': return mk(60 * 60 * 1000);
    case 'mid': return mk(5 * DAY);
    case 'ending': return mk(12 * DAY);
    case 'expired': return mk(TRIAL_DAYS * DAY + DAY);
    case 'readonly-ending': return mk(TRIAL_DAYS * DAY + 80 * DAY);
    case 'retention-ended': return mk(TRIAL_DAYS * DAY + 95 * DAY);
    case 'paid': return { ...mk(40 * DAY), status: 'active' };
  }
}

export const PHASE_LABEL: Record<TrialPhase, string> = {
  'trial-new': 'Trial started',
  trial: 'Trial',
  'trial-ending': 'Trial ending soon',
  readonly: 'Trial ended, read-only',
  'readonly-ending': 'Read-only, export soon',
  'retention-ended': 'Archived',
  active: 'Active plan',
};

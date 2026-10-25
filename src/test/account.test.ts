import { describe, expect, it } from 'vitest';
import { DAY, RETENTION_DAYS, SCENARIOS, accountNow, scenarioBilling, trialInfo } from '@/services/account';
import type { AccountState } from '@/services/contracts/account';
import { formatNumber, snap } from '@/lib/numfmt';

const acct = (billing: AccountState['billing'], shift = 0): AccountState => ({
  session: { authenticated: true, userId: 'U', email: 'a@b.co', name: 'A', emailVerified: true },
  workspace: { name: 'W', tenantId: 'T' }, billing, clockShiftMs: shift,
  verification: { issuedAt: null }, recovery: { requestedAt: null, usedTokens: [] },
  onboarding: { done: true, draft: { businessName: 'W', gstin: '', stateCode: '36', taxRate: '18', sells: 'general', catalogue: 'sample', invites: [] } },
  known: [], attempts: { failedLogins: [], signups: [] },
});
const NOW = Date.UTC(2026, 9, 25, 10, 0, 0);

describe('trial phases come from one record', () => {
  const phase = (n: (typeof SCENARIOS)[number]) => trialInfo(acct(scenarioBilling(n, NOW)), NOW);

  it('each named state maps to its phase and write permission', () => {
    expect(phase('new')).toMatchObject({ phase: 'trial-new', canWrite: true, daysLeft: 14 });
    expect(phase('mid')).toMatchObject({ phase: 'trial', canWrite: true, daysLeft: 9 });
    expect(phase('ending')).toMatchObject({ phase: 'trial-ending', canWrite: true, daysLeft: 2 });
    expect(phase('expired')).toMatchObject({ phase: 'readonly', canWrite: false, readOnly: true, retentionDaysLeft: RETENTION_DAYS - 1 });
    expect(phase('readonly-ending')).toMatchObject({ phase: 'readonly-ending', canWrite: false, retentionDaysLeft: 10 });
    expect(phase('retention-ended')).toMatchObject({ phase: 'retention-ended', archived: true, canWrite: false, retentionDaysLeft: 0 });
    expect(phase('paid')).toMatchObject({ phase: 'active', canWrite: true, paid: true });
  });

  it('the trial is 14 days from its start and the read-only window is 90 days from its end', () => {
    const b = scenarioBilling('mid', NOW);
    expect(new Date(b.trialEndsAt).getTime() - new Date(b.trialStartedAt).getTime()).toBe(14 * DAY);
    const t = trialInfo(acct(b), NOW);
    expect(t.retentionEndsAt).toBeNull();
    const after = trialInfo(acct(b), new Date(b.trialEndsAt).getTime() + 1);
    expect(after.retentionEndsAt!.getTime() - new Date(b.trialEndsAt).getTime()).toBe(90 * DAY);
  });

  it('writes stop at the very instant the trial ends', () => {
    const b = scenarioBilling('mid', NOW);
    const end = new Date(b.trialEndsAt).getTime();
    expect(trialInfo(acct(b), end - 1).canWrite).toBe(true);
    expect(trialInfo(acct(b), end).canWrite).toBe(false);
  });

  it('the prototype clock moves every phase together and nothing else', () => {
    const b = scenarioBilling('mid', NOW);
    const at = (days: number) => { const a = acct(b, days * DAY); return trialInfo(a, accountNow(a, NOW)); };
    expect(at(7).phase).toBe('trial-ending');
    expect(at(7).daysLeft).toBe(2);
    expect(at(14).phase).toBe('readonly');
    expect(at(9 + 91).phase).toBe('retention-ended');
  });
});

describe('animated-number formatting', () => {
  it('formats rupees with Indian grouping on every value', () => {
    expect(formatNumber({ kind: 'inr' }, 12450000)).toBe('₹1,24,500.00');
    expect(formatNumber({ kind: 'inrShort' }, 12450000)).toBe('₹1,24,500');
    expect(formatNumber({ kind: 'compact' }, 12450000)).toBe('₹1.2L');
    expect(formatNumber({ kind: 'inr' }, 0)).toBe('₹0.00');
    expect(formatNumber({ kind: 'inr' }, -2550)).toBe('−₹25.50');
  });
  it('rounds in-flight values to whole paise and counts, so a frame is always a displayable number', () => {
    expect(snap({ kind: 'inr' }, 1234.56)).toBe(1235);
    expect(formatNumber({ kind: 'int' }, 99999.6)).toBe('1,00,000');
    expect(formatNumber({ kind: 'int', unit: 'units' }, 1718)).toBe('1,718 units');
    expect(formatNumber({ kind: 'dec', digits: 2 }, 3.14159)).toBe('3.14');
    expect(formatNumber({ kind: 'pct', digits: 1 }, 18.04)).toBe('18.0%');
    expect(formatNumber({ kind: 'int' }, -4)).toBe('−4');
  });
});

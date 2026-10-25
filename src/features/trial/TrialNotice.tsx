import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { trialDate, tone } from './TrialPanel';
import { useTrial } from '@/services';

const KEY = 'sikick.trial-notice.dismissed';
const dismissed = () => { try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

/**
 * One slim line under the top bar, only when it matters: the last days of a trial, and any time the workspace is
 * read-only. It says what is true now and offers the next step. It does not count seconds or flash.
 */
export function TrialNotice() {
  const t = useTrial();
  const { pathname } = useLocation();
  const [gone, setGone] = useState(dismissed);
  if (pathname === '/trial-ended' || t.paid || t.phase === 'trial' || t.phase === 'trial-new') return null;
  if (t.phase === 'trial-ending' && gone) return null;
  const bar = tone(t);
  return (
    <div className="trial-bar" data-tone={bar === 'wine' ? undefined : bar} role="status" data-phase={t.phase}>
      {t.phase === 'trial-ending' && <span>Your trial ends in <b>{t.daysLeft} {t.daysLeft === 1 ? 'day' : 'days'}</b> ({trialDate(t.endsAt)}). After that the workspace is read-only.</span>}
      {(t.phase === 'readonly' || t.phase === 'readonly-ending') && <span>Your trial has ended: this workspace is <b>read-only</b>. You can view and export everything for <b>{t.retentionDaysLeft} more {t.retentionDaysLeft === 1 ? 'day' : 'days'}</b>.</span>}
      {t.phase === 'retention-ended' && <span>This workspace is <b>archived</b>. The 90-day read-only period ended on {trialDate(t.retentionEndsAt!)}.</span>}
      <span className="row" style={{ gap: 14 }}>
        {t.readOnly && !t.archived && <Link to="/account/export">Export your data</Link>}
        <Link to={t.archived ? '/trial-ended' : '/settings/billing'}>{t.archived ? 'What happens now' : 'Review plans'}</Link>
        {t.phase === 'trial-ending' && <button type="button" className="x" aria-label="Dismiss for this visit" onClick={() => { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } setGone(true); }}><X size={14} aria-hidden /></button>}
      </span>
    </div>
  );
}

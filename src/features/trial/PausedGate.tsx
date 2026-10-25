import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { trialDate } from './TrialPanel';
import { useTrial } from '@/services';

/** Shown in place of a screen that only makes sense while the workspace can change. Reading and exporting stay open. */
export function PausedGate({ what }: { what: string }) {
  const t = useTrial();
  return (
    <div className="page" data-width="narrow">
      <div className="panel panel-pad empty">
        <Lock size={26} color="var(--wine)" aria-hidden />
        <h3>{what} is paused</h3>
        <p>{t.archived ? 'This workspace is archived.' : 'The trial ended on ' + trialDate(t.endsAt) + ', so the workspace is read-only.'} You can still look at everything and export it{t.retentionDaysLeft ? ' for ' + t.retentionDaysLeft + ' more days' : ''}. Choosing a plan turns it back on.</p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/settings/billing">Review plans</Link>
          <Link className="btn" to="/account/export">Export your data</Link>
          <Link className="btn btn-ghost" to="/dashboard">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}

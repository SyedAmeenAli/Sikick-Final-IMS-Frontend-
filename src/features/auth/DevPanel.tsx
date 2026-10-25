import { useEffect, useState } from 'react';
import { SCENARIOS, PHASE_LABEL, type Scenario } from '@/services/account';
import { saveAccount, defaultAccount } from '@/services/adapters/account';
import { useAuth, useCommands, useIms, useTrial } from '@/services';

const FLAG = 'sikick.dev';
const on = () => { try { return window.localStorage.getItem(FLAG) === '1'; } catch { return false; } };

/**
 * PROTOTYPE-ONLY controls for reaching every trial and session state without waiting 14 real days. They are not part of the
 * ordinary interface: nothing renders unless the address carries ?dev=1 once (which is then remembered in this browser;
 * ?dev=0 turns it off). ?scenario=<name> and ?session=out apply a state straight from a link.
 */
export function DevPanel() {
  const cmd = useCommands();
  const auth = useAuth();
  const s = useIms();
  const t = useTrial();
  const [enabled, setEnabled] = useState(on);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get('dev');
    if (d === '1') { try { window.localStorage.setItem(FLAG, '1'); } catch { /* ignore */ } setEnabled(true); }
    if (d === '0') { try { window.localStorage.removeItem(FLAG); } catch { /* ignore */ } setEnabled(false); }
    if (!(d === '1' || on())) return;
    const sc = q.get('scenario') as Scenario | null;
    if (sc && (SCENARIOS as readonly string[]).includes(sc)) cmd.setTrialScenario(sc);
    if (q.get('session') === 'out') void auth.signOut();
  }, [cmd, auth]);

  if (!enabled) return null;
  return (
    <details className="panel glass devpanel" aria-label="Prototype states">
      <summary>Prototype states · {PHASE_LABEL[t.phase]}{t.phase.startsWith('trial') ? ', ' + t.daysLeft + ' d' : t.retentionDaysLeft !== null ? ', ' + t.retentionDaysLeft + ' d left' : ''}</summary>
      <div className="row">{SCENARIOS.map((n) => <button key={n} type="button" onClick={() => cmd.setTrialScenario(n)}>{n}</button>)}</div>
      <div className="row">
        <button type="button" onClick={() => cmd.shiftClock(1)}>+1 day</button>
        <button type="button" onClick={() => cmd.shiftClock(7)}>+7 days</button>
        <button type="button" onClick={() => cmd.shiftClock(30)}>+30 days</button>
        <button type="button" onClick={() => cmd.shiftClock(-s.account.clockShiftMs / 86400000)}>clock to now</button>
      </div>
      <div className="row">
        <button type="button" onClick={() => void auth.signOut()}>sign out</button>
        <button type="button" onClick={() => { saveAccount(defaultAccount()); window.location.assign('/dashboard'); }}>reset account</button>
      </div>
    </details>
  );
}

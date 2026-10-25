import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ImsCommands, ImsService, ImsState } from './contracts/service';
import type { AuthService } from './contracts/account';
import { createLocalService } from './adapters/local';
import { trialInfo, type TrialInfo } from './account';

const service = createLocalService();
const Ctx = createContext<ImsService>(service);
/** One clock for the whole app: a coarse tick so day counts and phases re-evaluate together, never per component. */
const ClockCtx = createContext(0);

export function ImsProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 30_000); return () => window.clearInterval(t); }, []);
  return <Ctx.Provider value={service}><ClockCtx.Provider value={tick}>{children}</ClockCtx.Provider></Ctx.Provider>;
}

export function useIms(): ImsState {
  const svc = useContext(Ctx);
  return useSyncExternalStore(svc.subscribe, svc.getState, svc.getState);
}
export function useCommands(): ImsCommands {
  return useContext(Ctx).commands;
}
export function useAuth(): AuthService {
  return useContext(Ctx).auth;
}
/** The trial and read-only state, from the one account record. Every screen that shows it reads this. */
export function useTrial(): TrialInfo {
  const s = useIms();
  const tick = useContext(ClockCtx);
  return useMemo(() => trialInfo(s.account), [s.account, tick]);
}
/** Derived value that only recomputes when the store changes. */
export function useSelect<T>(fn: (s: ImsState) => T): T {
  const s = useIms();
  return useMemo(() => fn(s), [s]);
}

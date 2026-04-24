import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  GlobalMuteManager,
  getDefaultGlobalMuteManager,
} from '../../core/GlobalMuteManager.ts';
import {
  GlobalMuteContext,
  type GlobalMuteContextValue,
} from './globalMuteContextValue.ts';

export { GlobalMuteContext };
export type { GlobalMuteContextValue };

interface GlobalMuteProviderProps {
  children: ReactNode;
  /**
   * Optional manager override. Useful for tests or for apps that want
   * scoped mute state. Defaults to the process-wide singleton.
   */
  manager?: GlobalMuteManager;
  initialMuted?: boolean;
}

export function GlobalMuteProvider({
  children,
  manager: managerProp,
  initialMuted,
}: GlobalMuteProviderProps) {
  const manager = useMemo(() => {
    if (managerProp) return managerProp;
    const m = getDefaultGlobalMuteManager();
    if (initialMuted !== undefined) m.setMuted(initialMuted);
    return m;
    // initialMuted is intentionally only applied on first mount of the
    // provider, hence the empty dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerProp]);

  const [muted, setMutedState] = useState(manager.isMuted());

  useEffect(() => {
    return manager.subscribe(setMutedState);
  }, [manager]);

  const value = useMemo<GlobalMuteContextValue>(
    () => ({
      muted,
      setMuted: (next: boolean) => manager.setMuted(next),
      toggle: () => manager.toggle(),
      manager,
    }),
    [muted, manager],
  );

  return (
    <GlobalMuteContext.Provider value={value}>
      {children}
    </GlobalMuteContext.Provider>
  );
}

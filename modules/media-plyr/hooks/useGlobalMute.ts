import { useCallback, useContext, useEffect, useState } from 'react';
import { GlobalMuteContext } from '../components/context/globalMuteContextValue.ts';
import { getDefaultGlobalMuteManager } from '../core/GlobalMuteManager.ts';

export interface UseGlobalMuteResult {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggle: () => boolean;
}

/**
 * React hook for reading and updating the shared mute state.
 *
 * Prefers the nearest `<GlobalMuteProvider>` when one is mounted. If no
 * provider is in the tree, falls back to the process-wide default manager
 * so existing single-instance setups keep working without any boilerplate.
 */
export function useGlobalMute(): UseGlobalMuteResult {
  const ctx = useContext(GlobalMuteContext);

  // Hooks below run unconditionally — they only do real work when no
  // provider is mounted (`ctx === null`).
  const fallbackManager = getDefaultGlobalMuteManager();
  const [fallbackMuted, setFallbackMuted] = useState(() =>
    fallbackManager.isMuted(),
  );

  useEffect(() => {
    if (ctx) return;
    return fallbackManager.subscribe(setFallbackMuted);
  }, [ctx, fallbackManager]);

  const setMuted = useCallback(
    (next: boolean) => {
      if (ctx) ctx.setMuted(next);
      else fallbackManager.setMuted(next);
    },
    [ctx, fallbackManager],
  );

  const toggle = useCallback((): boolean => {
    if (ctx) {
      ctx.toggle();
      return ctx.manager.isMuted();
    }
    return fallbackManager.toggle();
  }, [ctx, fallbackManager]);

  return {
    muted: ctx ? ctx.muted : fallbackMuted,
    setMuted,
    toggle,
  };
}

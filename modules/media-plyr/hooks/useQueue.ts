import { useState, useCallback, useEffect } from 'react';
import { QueueManager } from '../core/QueueManager.ts';
import type { MediaTrack, RepeatMode, QueueState } from '../types/index.ts';

export function useQueue(initialTracks: MediaTrack[] = []) {
  const [manager] = useState(() => new QueueManager(initialTracks));
  const [state, setState] = useState<QueueState>(() => manager.getState());

  useEffect(() => {
    const sync = () => setState(manager.getState());
    manager.on('queuechange', sync);
    manager.on('trackchange', sync);
    return () => {
      manager.off('queuechange', sync);
      manager.off('trackchange', sync);
    };
  }, [manager]);

  const next = useCallback(() => manager.next(), [manager]);
  const prev = useCallback(() => manager.prev(), [manager]);
  const skipTo = useCallback((index: number) => manager.skipTo(index), [manager]);

  const setRepeat = useCallback((mode: RepeatMode) => manager.setRepeat(mode), [manager]);
  const setShuffle = useCallback((enabled: boolean) => manager.setShuffle(enabled), [manager]);

  const addTrack = useCallback(
    (track: MediaTrack, position?: number) => manager.addTrack(track, position),
    [manager],
  );
  const removeTrack = useCallback((index: number) => manager.removeTrack(index), [manager]);
  const reorder = useCallback(
    (from: number, to: number) => manager.reorder(from, to),
    [manager],
  );
  const setTracks = useCallback((tracks: MediaTrack[]) => manager.setTracks(tracks), [manager]);
  const clear = useCallback(() => manager.clear(), [manager]);

  const currentTrack = state.currentIndex >= 0 && state.currentIndex < state.tracks.length
    ? state.tracks[state.currentIndex]
    : null;

  const hasNextVal = state.tracks.length > 0 && (
    state.repeat === 'all' || state.repeat === 'one' || state.currentIndex < state.tracks.length - 1
  );
  const hasPrevVal = state.tracks.length > 0 && (
    state.repeat === 'all' || state.repeat === 'one' || state.currentIndex > 0
  );

  return {
    state,
    currentTrack,
    hasNext: hasNextVal,
    hasPrev: hasPrevVal,
    next,
    prev,
    skipTo,
    setRepeat,
    setShuffle,
    addTrack,
    removeTrack,
    reorder,
    setTracks,
    clear,
    manager,
  };
}

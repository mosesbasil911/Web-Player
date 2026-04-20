import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { MediaPlyr } from '../core/MediaPlyr.ts';
import type { MediaPlyrConfig, PlaybackState, MediaPlyrInstance } from '../types/index.ts';

const DEFAULT_STATE: PlaybackState = {
  playing: false,
  paused: true,
  ended: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  fullscreen: false,
  pip: false,
  seeking: false,
  waiting: false,
};

export function useMediaPlyr(config: MediaPlyrConfig) {
  const playerRef = useRef<MediaPlyr | null>(null);
  const [mediaElement, setMediaElement] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlaybackState>(DEFAULT_STATE);
  const [error, setError] = useState<{ code: number; message: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [instance, setInstance] = useState<MediaPlyrInstance | null>(null);

  const sourcesSignature = useMemo(() => {
    return config.sources
      .map((source) => `${source.container}:${source.url}`)
      .join('|');
  }, [config.sources]);

  const ref = useCallback((el: HTMLVideoElement | HTMLAudioElement | null) => {
    setMediaElement(el);
  }, []);

  // Effect A: create the MediaPlyr instance once per element+kind.
  // The Shaka player is attached here and kept alive for the element's lifetime.
  useEffect(() => {
    if (!mediaElement) return;

    setError(null);
    setReady(false);
    setState(DEFAULT_STATE);

    const plyr = new MediaPlyr(config);
    playerRef.current = plyr;

    plyr.on('loading', () => {
      setReady(false);
      setError(null);
      setState(DEFAULT_STATE);
    });
    plyr.on('loaded', () => {
      setState(plyr.getPlaybackState());
      setReady(true);
    });
    plyr.on('error', (data) => {
      const err = data as { code: number; message: string };
      setError(err);
    });

    const stateEvents = [
      'play', 'pause', 'ended', 'timeupdate', 'volumechange',
      'ratechange', 'seeking', 'seeked', 'buffering',
      'fullscreenchange', 'pipchange',
    ] as const;
    for (const event of stateEvents) {
      plyr.on(event, () => setState(plyr.getPlaybackState()));
    }

    plyr.attach(mediaElement).then(() => {
      setInstance(plyr);
    });

    return () => {
      plyr.destroy();
      playerRef.current = null;
      setInstance(null);
      setReady(false);
      setState(DEFAULT_STATE);
    };
    // Only recreate the player when the element or media kind changes.
    // Source changes are handled by Effect B via loadSource().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaElement, config.kind]);

  // Effect B: when the source URL(s), startTime, or preferredOrder change,
  // reload the manifest into the EXISTING Shaka player instead of destroying
  // and recreating it. This avoids the race condition caused by
  // shaka.Player.destroy() being async but not awaited.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const plyr = playerRef.current;
    // Skip on initial mount — attach() in Effect A handles the first load.
    // We detect "initial" by checking whether the player has already attached
    // (videoElement is non-null after attach resolves).
    if (!plyr || !plyr.videoElement) return;

    setReady(false);
    setError(null);
    plyr.loadSource(configRef.current);
  }, [sourcesSignature, config.startTime, config.preferredOrder]);

  const getInstance = useCallback((): MediaPlyrInstance | null => {
    return playerRef.current;
  }, []);

  return {
    ref,
    state,
    error,
    ready,
    player: instance,
    getInstance,
  };
}

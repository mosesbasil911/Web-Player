import { useRef, useEffect, useState, useCallback } from 'react';
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

  const ref = useCallback((el: HTMLVideoElement | HTMLAudioElement | null) => {
    setMediaElement(el);
  }, []);

  useEffect(() => {
    if (!mediaElement) return;

    const plyr = new MediaPlyr(config);
    playerRef.current = plyr;

    plyr.on('loaded', () => setReady(true));
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
      setError(null);
    };
    // Re-attach when src or type changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaElement, config.src, config.type]);

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

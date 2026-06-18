import { useEffect, useRef, useState } from 'react';
import { AirPlayManager } from '../../integrations/AirPlayManager.ts';
import type {
  AirPlayStateEvent,
  MediaPlyrInstance,
} from '../../types/index.ts';

export interface AirPlayButtonProps {
  player: MediaPlyrInstance | null;
}

/**
 * Renders an AirPlay button in Safari (macOS / iOS). The button is always
 * visible when the WebKit AirPlay API is supported; clicking opens the native
 * OS device picker. Dimmed when no targets are on the network yet.
 *
 * Hidden in Chrome, Firefox, and Edge — safe to include in the control bar
 * unconditionally.
 */
export function AirPlayButton({ player }: AirPlayButtonProps) {
  const managerRef = useRef<AirPlayManager | null>(null);
  const [supported] = useState(() => AirPlayManager.isSupported());
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!player || !supported) return;

    const mgr = new AirPlayManager(player);
    managerRef.current = mgr;

    const handler = (data?: unknown) => {
      const e = data as AirPlayStateEvent;
      setAvailable(e.available);
      setActive(e.active);
    };

    mgr.on('airplaystate', handler);
    mgr.init();

    return () => {
      mgr.off('airplaystate', handler);
      mgr.destroy();
      managerRef.current = null;
    };
  }, [player, supported]);

  if (!supported) return null;

  const label = active
    ? 'Stop AirPlay'
    : available
      ? 'AirPlay'
      : 'AirPlay — no devices found';

  return (
    <button
      className={`media-plyr__btn media-plyr__btn--airplay${active ? ' media-plyr__btn--active' : ''}${!available && !active ? ' media-plyr__btn--airplay-idle' : ''}`}
      onClick={() => managerRef.current?.showPicker()}
      aria-label={label}
      title={label}
    >
      {/*
       * Apple-style AirPlay icon: a screen with an upward-pointing triangle
       * at the base, matching the system AirPlay glyph.
       */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Screen rectangle */}
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
        {/* AirPlay triangle */}
        <polygon
          points="12 15 17 21 7 21"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

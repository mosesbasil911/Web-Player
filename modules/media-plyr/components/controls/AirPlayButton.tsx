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
 * Renders an AirPlay button that appears only when AirPlay targets are
 * available on the local network (Safari / WebKit only). Clicking it opens
 * the native OS device picker. The button reflects active-streaming state
 * with the `media-plyr__btn--active` modifier class.
 *
 * The component hides itself (`return null`) on any browser that does not
 * support the WebKit AirPlay API (Chrome, Firefox, Edge), so it is safe to
 * include in the control bar unconditionally.
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

  // Hidden in non-WebKit browsers or when no AirPlay devices are nearby.
  if (!supported || !available) return null;

  const label = active ? 'Stop AirPlay' : 'AirPlay';

  return (
    <button
      className={`media-plyr__btn media-plyr__btn--airplay${active ? ' media-plyr__btn--active' : ''}`}
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

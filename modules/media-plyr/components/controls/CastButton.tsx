import { useCallback, useEffect, useRef, useState } from 'react';
import { CastManager } from '../../integrations/CastManager.ts';
import type {
  MediaPlyrInstance,
  PlaybackState,
  CastConfig,
  CastConnectionState,
  CastStateEvent,
} from '../../types/index.ts';

export interface CastButtonProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
  castConfig?: CastConfig;
}

export function CastButton({ player, castConfig }: CastButtonProps) {
  const managerRef = useRef<CastManager | null>(null);
  const [connectionState, setConnectionState] = useState<CastConnectionState>(
    'NO_DEVICES_AVAILABLE',
  );
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [supported, setSupported] = useState(() => CastManager.isSupported());

  useEffect(() => {
    if (!player || !supported) return;

    const mgr = new CastManager(player, castConfig);
    managerRef.current = mgr;

    const handler = (data?: unknown) => {
      const e = data as CastStateEvent;
      setConnectionState(e.connectionState);
      setDeviceName(e.deviceName);
    };

    mgr.on('caststate', handler);

    mgr.init().then(() => {
      if (!CastManager.isSupported()) {
        setSupported(false);
      }
    });

    return () => {
      mgr.destroy();
      managerRef.current = null;
    };
  }, [player, supported, castConfig]);

  const handleClick = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;

    if (connectionState === 'CONNECTED') {
      mgr.endSession();
    } else {
      mgr.requestSession();
    }
  }, [connectionState]);

  if (!supported) return null;
  if (connectionState === 'NO_DEVICES_AVAILABLE') return null;

  const connected = connectionState === 'CONNECTED';
  const connecting = connectionState === 'CONNECTING';

  const label = connected
    ? `Casting to ${deviceName ?? 'device'}`
    : connecting
      ? 'Connecting…'
      : 'Cast';

  return (
    <button
      className={`media-plyr__btn media-plyr__btn--cast${connected ? ' media-plyr__btn--active' : ''}${connecting ? ' media-plyr__btn--cast-connecting' : ''}`}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {connected ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          <line x1="2" y1="20" x2="2.01" y2="20" />
          <rect
            x="8"
            y="8"
            width="12"
            height="10"
            rx="1"
            fill="currentColor"
            opacity="0.25"
          />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          <line x1="2" y1="20" x2="2.01" y2="20" />
        </svg>
      )}
    </button>
  );
}

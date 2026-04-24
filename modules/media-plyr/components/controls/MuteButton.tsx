import { useGlobalMute } from '../../hooks/useGlobalMute.ts';
import type { MediaPlyrInstance, PlaybackState } from '../../types/index.ts';

interface MuteButtonProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function MuteButton({ player, state }: MuteButtonProps) {
  const { muted: globalMuted, toggle } = useGlobalMute();
  const muted = state.muted || globalMuted;

  const handleClick = () => {
    const next = toggle();
    player?.setMuted(next);
  };

  const volumeHigh = !muted && state.volume > 0.5;
  const volumeLow = !muted && state.volume > 0 && state.volume <= 0.5;
  const volumeOff = muted || state.volume === 0;

  return (
    <button
      className="media-plyr__btn media-plyr__btn--mute"
      onClick={handleClick}
      aria-label={muted ? 'Unmute' : 'Mute'}
      aria-pressed={muted}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {volumeHigh && (
          <>
            <path
              d="M15.54 8.46a5 5 0 0 1 0 7.07"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M19.07 4.93a10 10 0 0 1 0 14.14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
        {volumeLow && (
          <path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {volumeOff && (
          <path
            d="M17 9l-6 6m0-6l6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}

import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";

interface PlayPauseButtonProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function PlayPauseButton({ player, state }: PlayPauseButtonProps) {
  const handleClick = () => {
    if (!player) return;
    if (state.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <button
      className="media-plyr__btn media-plyr__btn--play-pause"
      onClick={handleClick}
      aria-label={state.playing ? "Pause" : "Play"}
    >
      {state.playing ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
        </svg>
      )}
    </button>
  );
}

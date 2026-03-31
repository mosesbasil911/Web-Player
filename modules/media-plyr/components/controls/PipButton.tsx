import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";

interface PipButtonProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function PipButton({ player, state }: PipButtonProps) {
  if (!document.pictureInPictureEnabled) return null;

  const handleClick = () => {
    player?.togglePip();
  };

  return (
    <button
      className="media-plyr__btn media-plyr__btn--pip"
      onClick={handleClick}
      aria-label={state.pip ? "Exit picture-in-picture" : "Picture-in-picture"}
    >
      {state.pip ? (
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
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <rect
            x="4"
            y="5"
            width="10"
            height="8"
            rx="1"
            fill="currentColor"
            opacity="0.3"
          />
          <path d="M18 21l-4-4h3a1 1 0 0 0 1-1v-3" />
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
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <rect
            x="10"
            y="9"
            width="10"
            height="8"
            rx="1"
            fill="currentColor"
            opacity="0.3"
          />
        </svg>
      )}
    </button>
  );
}

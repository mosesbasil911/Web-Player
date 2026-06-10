import type { MediaPlyrInstance } from '../../types/index.ts';

interface SeekButtonsProps {
  player: MediaPlyrInstance | null;
  seekStep?: number;
}

export function SeekButtons({ player, seekStep = 5 }: SeekButtonsProps) {
  return (
    <>
      <button
        className="media-plyr__btn media-plyr__btn--seek-backward"
        onClick={() => player?.seekBackward()}
        aria-label={`Seek backward ${seekStep} seconds`}
      >
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
          <path d="M11 19a8 8 0 1 0 0-14" />
          <polyline points="11 1 7 5 11 9" />
        </svg>
        <span className="media-plyr__seek-label">{seekStep}</span>
      </button>

      <button
        className="media-plyr__btn media-plyr__btn--seek-forward"
        onClick={() => player?.seekForward()}
        aria-label={`Seek forward ${seekStep} seconds`}
      >
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
          <path d="M13 19a8 8 0 1 1 0-14" />
          <polyline points="13 1 17 5 13 9" />
        </svg>
        <span className="media-plyr__seek-label">{seekStep}</span>
      </button>
    </>
  );
}

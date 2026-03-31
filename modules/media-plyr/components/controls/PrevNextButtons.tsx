interface PrevNextButtonsProps {
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PrevNextButtons({
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
}: PrevNextButtonsProps) {
  return (
    <>
      <button
        className="media-plyr__btn media-plyr__btn--prev"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="5" width="3" height="14" rx="1" />
          <path d="M20 5.5v13a1 1 0 0 1-1.54.84l-10-6.5a1 1 0 0 1 0-1.68l10-6.5A1 1 0 0 1 20 5.5z" />
        </svg>
      </button>

      <button
        className="media-plyr__btn media-plyr__btn--next"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="17" y="5" width="3" height="14" rx="1" />
          <path d="M4 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 4 5.5z" />
        </svg>
      </button>
    </>
  );
}

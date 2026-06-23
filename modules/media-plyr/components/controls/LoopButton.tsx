interface LoopButtonProps {
  loop: boolean;
  onLoopChange?: (loop: boolean) => void;
}

export function LoopButton({ loop, onLoopChange }: LoopButtonProps) {
  const toggle = () => onLoopChange?.(!loop);

  return (
    <button
      className={`media-plyr__btn media-plyr__btn--repeat${
        loop ? ' media-plyr__btn--active' : ''
      }`}
      onClick={toggle}
      aria-label={loop ? 'Loop on' : 'Loop off'}
      aria-pressed={loop}
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
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    </button>
  );
}

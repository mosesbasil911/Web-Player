import type { RepeatMode } from "../../types/index.ts";

interface RepeatShuffleButtonsProps {
  repeat: RepeatMode;
  shuffle: boolean;
  onRepeatChange?: (mode: RepeatMode) => void;
  onShuffleChange?: (shuffle: boolean) => void;
}

const REPEAT_CYCLE: RepeatMode[] = ["none", "all", "one"];

export function RepeatShuffleButtons({
  repeat,
  shuffle,
  onRepeatChange,
  onShuffleChange,
}: RepeatShuffleButtonsProps) {
  const cycleRepeat = () => {
    const nextIndex = (REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length;
    onRepeatChange?.(REPEAT_CYCLE[nextIndex]);
  };

  const toggleShuffle = () => {
    onShuffleChange?.(!shuffle);
  };

  const repeatLabel =
    repeat === "one"
      ? "Repeat one"
      : repeat === "all"
        ? "Repeat all"
        : "Repeat off";

  return (
    <>
      <button
        className={`media-plyr__btn media-plyr__btn--repeat${
          repeat !== "none" ? " media-plyr__btn--active" : ""
        }`}
        onClick={cycleRepeat}
        aria-label={repeatLabel}
      >
        {repeat === "one" ? (
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
            <text
              x="12"
              y="14.5"
              textAnchor="middle"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontWeight="bold"
            >
              1
            </text>
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
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        )}
      </button>

      <button
        className={`media-plyr__btn media-plyr__btn--shuffle${
          shuffle ? " media-plyr__btn--active" : ""
        }`}
        onClick={toggleShuffle}
        aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
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
          <path d="M16 3h5v5" />
          <path d="M4 20L21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
      </button>
    </>
  );
}

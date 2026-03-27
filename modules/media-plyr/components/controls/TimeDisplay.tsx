import { formatTime } from "../../utils/formatTime.ts";
import type { PlaybackState } from "../../types/index.ts";

interface TimeDisplayProps {
  state: PlaybackState;
}

export function TimeDisplay({ state }: TimeDisplayProps) {
  return (
    <span className="media-plyr__time">
      {formatTime(state.currentTime)}
      <span className="media-plyr__time-separator"> / </span>
      {formatTime(state.duration)}
    </span>
  );
}

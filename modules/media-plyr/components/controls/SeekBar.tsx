import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";

interface SeekBarProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function SeekBar({ player, state }: SeekBarProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    player?.seek(Number(e.target.value));
  };

  const duration = state.duration || 0;
  const playedPercent = duration > 0 ? (state.currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (state.buffered / duration) * 100 : 0;

  return (
    <div className="media-plyr__seek-wrapper">
      <div className="media-plyr__seek-track">
        <div
          className="media-plyr__seek-buffered"
          style={{ width: `${bufferedPercent}%` }}
        />
        <div
          className="media-plyr__seek-played"
          style={{ width: `${playedPercent}%` }}
        />
      </div>
      <input
        type="range"
        className="media-plyr__seek-bar"
        min={0}
        max={duration}
        step={0.1}
        value={state.currentTime}
        onChange={handleChange}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={state.currentTime}
      />
    </div>
  );
}

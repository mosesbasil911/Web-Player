import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";

interface VolumeControlProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function VolumeControl({ player, state }: VolumeControlProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    player?.setVolume(Number(e.target.value));
  };

  const fillPercent = state.muted ? 0 : state.volume * 100;

  return (
    <input
      type="range"
      className="media-plyr__volume-bar"
      min={0}
      max={1}
      step={0.01}
      value={state.muted ? 0 : state.volume}
      onChange={handleChange}
      aria-label="Volume"
      style={
        {
          "--plyr-range-fill": `${fillPercent}%`,
        } as React.CSSProperties
      }
    />
  );
}

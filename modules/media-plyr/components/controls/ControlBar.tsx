import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";
import { PlayPauseButton } from "./PlayPauseButton.tsx";
import { SeekBar } from "./SeekBar.tsx";
import { VolumeControl } from "./VolumeControl.tsx";
import { MuteButton } from "./MuteButton.tsx";
import { TimeDisplay } from "./TimeDisplay.tsx";
import { FullscreenButton } from "./FullscreenButton.tsx";

export interface ControlBarProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

export function ControlBar({ player, state }: ControlBarProps) {
  return (
    <div className="media-plyr__controls">
      <div className="media-plyr__controls-top">
        <SeekBar player={player} state={state} />
      </div>

      <div className="media-plyr__controls-bottom">
        <div className="media-plyr__controls-left">
          <PlayPauseButton player={player} state={state} />
          <MuteButton player={player} state={state} />
          <VolumeControl player={player} state={state} />
          <TimeDisplay state={state} />
        </div>

        <div className="media-plyr__controls-right">
          <FullscreenButton player={player} state={state} />
        </div>
      </div>
    </div>
  );
}

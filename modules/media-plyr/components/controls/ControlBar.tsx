import type {
  MediaPlyrInstance,
  PlaybackState,
  RepeatMode,
} from "../../types/index.ts";
import { PlayPauseButton } from "./PlayPauseButton.tsx";
import { SeekBar } from "./SeekBar.tsx";
import { VolumeControl } from "./VolumeControl.tsx";
import { MuteButton } from "./MuteButton.tsx";
import { TimeDisplay } from "./TimeDisplay.tsx";
import { FullscreenButton } from "./FullscreenButton.tsx";
import { SpeedSelector } from "./SpeedSelector.tsx";
import { PrevNextButtons } from "./PrevNextButtons.tsx";
import { RepeatShuffleButtons } from "./RepeatShuffleButtons.tsx";
import { PipButton } from "./PipButton.tsx";

export interface ControlBarProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;

  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;

  repeat?: RepeatMode;
  shuffle?: boolean;
  onRepeatChange?: (mode: RepeatMode) => void;
  onShuffleChange?: (shuffle: boolean) => void;
}

export function ControlBar({
  player,
  state,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  repeat = "none",
  shuffle = false,
  onRepeatChange,
  onShuffleChange,
}: ControlBarProps) {
  return (
    <div className="media-plyr__controls">
      <div className="media-plyr__controls-top">
        <SeekBar player={player} state={state} />
      </div>

      <div className="media-plyr__controls-bottom">
        <div className="media-plyr__controls-left">
          <PlayPauseButton player={player} state={state} />
          <PrevNextButtons
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={onPrev}
            onNext={onNext}
          />
          <MuteButton player={player} state={state} />
          <VolumeControl player={player} state={state} />
          <TimeDisplay state={state} />
        </div>

        <div className="media-plyr__controls-right">
          <RepeatShuffleButtons
            repeat={repeat}
            shuffle={shuffle}
            onRepeatChange={onRepeatChange}
            onShuffleChange={onShuffleChange}
          />
          <SpeedSelector player={player} state={state} />
          <PipButton player={player} state={state} />
          <FullscreenButton player={player} state={state} />
        </div>
      </div>
    </div>
  );
}

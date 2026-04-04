import { useCallback, useRef, useState } from "react";
import type { MediaPlyrInstance, PlaybackState } from "../../types/index.ts";

interface SeekBarProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

const SEEK_LANDED_THRESHOLD = 1;

export function SeekBar({ player, state }: SeekBarProps) {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const wasPlayingRef = useRef(false);

  if (
    pendingSeek !== null &&
    Math.abs(state.currentTime - pendingSeek) < SEEK_LANDED_THRESHOLD
  ) {
    setPendingSeek(null);
  }

  const duration = state.duration || 0;
  const displayTime = scrubbing
    ? scrubTime
    : (pendingSeek ?? state.currentTime);
  const playedPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (state.buffered / duration) * 100 : 0;

  const startScrub = useCallback(() => {
    setScrubbing(true);
    wasPlayingRef.current = state.playing;
    if (state.playing) player?.pause();
  }, [player, state.playing]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = Number(e.target.value);
      setScrubTime(t);
      if (!scrubbing) {
        player?.seek(t);
        setPendingSeek(t);
      }
    },
    [player, scrubbing],
  );

  const commitScrub = useCallback(() => {
    if (!scrubbing) return;
    player?.seek(scrubTime);
    setPendingSeek(scrubTime);
    setScrubbing(false);
    if (wasPlayingRef.current) player?.play();
  }, [player, scrubTime, scrubbing]);

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
        value={displayTime}
        onPointerDown={startScrub}
        onChange={handleInput}
        onPointerUp={commitScrub}
        onTouchEnd={commitScrub}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={displayTime}
      />
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import type {
  MediaPlyrInstance,
  PlaybackState,
  PlaybackSpeed,
} from "../../types/index.ts";

interface SpeedSelectorProps {
  player: MediaPlyrInstance | null;
  state: PlaybackState;
}

const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function SpeedSelector({ player, state }: SpeedSelectorProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [open]);

  const handleSelect = (speed: PlaybackSpeed) => {
    player?.setPlaybackRate(speed);
    setOpen(false);
  };

  const label = state.playbackRate === 1 ? "1x" : `${state.playbackRate}x`;

  return (
    <div className="media-plyr__speed" ref={menuRef}>
      <button
        className="media-plyr__btn media-plyr__btn--speed"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Playback speed: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="media-plyr__speed-label">{label}</span>
      </button>

      {open && (
        <ul className="media-plyr__speed-menu" role="menu">
          {SPEEDS.map((speed) => (
            <li key={speed} role="menuitem">
              <button
                className={`media-plyr__speed-option${
                  state.playbackRate === speed
                    ? " media-plyr__speed-option--active"
                    : ""
                }`}
                onClick={() => handleSelect(speed)}
              >
                {speed === 1 ? "Normal" : `${speed}x`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect } from "react";
import type { MediaPlyrInstance, PlaybackState } from "../types/index.ts";

export function useKeyboardShortcuts(
  player: MediaPlyrInstance | null,
  state: PlaybackState,
  seekStep: number = 5,
) {
  useEffect(() => {
    if (!player) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (state.playing) {
            player.pause();
          } else {
            player.play();
          }
          break;

        case "m":
        case "M":
          e.preventDefault();
          player.setMuted(!state.muted);
          break;

        case "ArrowLeft":
          e.preventDefault();
          player.seekBackward(seekStep);
          break;

        case "ArrowRight":
          e.preventDefault();
          player.seekForward(seekStep);
          break;

        case "ArrowUp":
          e.preventDefault();
          player.setVolume(Math.min(1, state.volume + 0.1));
          break;

        case "ArrowDown":
          e.preventDefault();
          player.setVolume(Math.max(0, state.volume - 0.1));
          break;

        case "f":
        case "F":
          e.preventDefault();
          player.toggleFullscreen();
          break;

        case "c":
        case "C": {
          e.preventDefault();
          const textTracks = player.getTextTracks();
          if (textTracks.length === 0) break;

          if (player.isTextVisible()) {
            player.setTextVisible(false);
          } else {
            const active = textTracks.find((t) => t.active);
            if (!active) {
              player.selectTextTrack(textTracks[0].id);
            }
            player.setTextVisible(true);
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [player, state, seekStep]);
}

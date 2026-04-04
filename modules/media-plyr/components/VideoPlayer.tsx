import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaPlyr } from "../hooks/useMediaPlyr.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { orderSources } from "../utils/orderSources.ts";
import { PlaybackMemory } from "../core/PlaybackMemory.ts";
import { ControlBar } from "./controls/ControlBar.tsx";
import { ErrorOverlay } from "./overlays/ErrorOverlay.tsx";
import { BufferingOverlay } from "./overlays/BufferingOverlay.tsx";
import type { VideoPlayerProps, RepeatMode } from "../types/index.ts";
import "../styles/media-plyr.css";

export function VideoPlayer({
  config,
  className,
  onReady,
  onError,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: VideoPlayerProps) {
  const memoryConfig = config.playbackMemory;
  const mediaId = config.sources[0]?.url ?? config.title;

  const resolvedConfig = useMemo(() => {
    if (!memoryConfig?.enabled) return config;

    const memory = new PlaybackMemory(memoryConfig);
    const saved = memory.getSavedPosition(mediaId);
    if (
      saved !== null &&
      (config.startTime === undefined || config.startTime === 0)
    ) {
      return { ...config, startTime: saved };
    }
    return config;
  }, [config, memoryConfig, mediaId]);

  const { ref, state, error, ready, player } = useMediaPlyr(resolvedConfig);

  useKeyboardShortcuts(player, state);

  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [shuffle, setShuffle] = useState(false);

  useEffect(() => {
    if (!memoryConfig?.enabled || !player?.videoElement) return;

    const memory = new PlaybackMemory(memoryConfig);
    memory.attach(player.videoElement as HTMLMediaElement, mediaId);
    return () => memory.detach();
  }, [player, memoryConfig, mediaId]);

  const orderedSources = useMemo(
    () => orderSources(config.sources, config.preferredOrder),
    [config.sources, config.preferredOrder],
  );

  useEffect(() => {
    if (ready && player && onReady) {
      onReady(player);
    }
  }, [ready, player, onReady]);

  useEffect(() => {
    if (error && error.code !== 1001 && onError) {
      onError({
        code: error.code,
        message: error.message,
        severity: "fatal",
      });
    }
  }, [error, onError]);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const hasFatalError = error && error.code !== 1001;
  const isBuffering = ready && state.waiting && !state.paused && !state.ended;

  if (hasFatalError) {
    return (
      <div className={`media-plyr media-plyr--error ${className ?? ""}`}>
        <ErrorOverlay
          error={{
            code: error.code,
            message: error.message,
            severity: "fatal",
          }}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className={`media-plyr media-plyr--video ${className ?? ""}`}>
      <div className="media-plyr__container">
        <video
          ref={ref}
          className="media-plyr__video"
          poster={config.poster}
          muted={!!config.muted}
          playsInline
          crossOrigin={config.crossOrigin}
          aria-label={config.title}
        >
          {orderedSources.map((source) => (
            <source
              key={`${source.container}-${source.url}`}
              src={source.url}
              type={source.mimeType}
            />
          ))}
        </video>

        {!ready && (
          <div className="media-plyr__loading-overlay">
            <div className="media-plyr__spinner" />
          </div>
        )}

        <BufferingOverlay visible={isBuffering} />

        <ControlBar
          player={player}
          state={state}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={onPrev}
          onNext={onNext}
          repeat={repeat}
          shuffle={shuffle}
          onRepeatChange={setRepeat}
          onShuffleChange={setShuffle}
        />
      </div>
    </div>
  );
}

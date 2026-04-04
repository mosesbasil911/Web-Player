import { useCallback, useEffect, useMemo } from "react";
import { useMediaPlyr } from "../hooks/useMediaPlyr.ts";
import { orderSources } from "../utils/orderSources.ts";
import { ErrorOverlay } from "./overlays/ErrorOverlay.tsx";
import type { AudioPlayerProps } from "../types/index.ts";
import "../styles/media-plyr.css";

export function AudioPlayer({
  config,
  className,
  onReady,
  onError,
}: AudioPlayerProps) {
  const { ref, error, ready, player } = useMediaPlyr(config);

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

  if (hasFatalError) {
    return (
      <div
        className={`media-plyr media-plyr--audio media-plyr--error ${className ?? ""}`}
      >
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
    <div className={`media-plyr media-plyr--audio ${className ?? ""}`}>
      <audio
        ref={ref}
        aria-label={config.title}
        crossOrigin={config.crossOrigin}
        controls
        preload="metadata"
      >
        {orderedSources.map((source) => (
          <source
            key={`${source.container}-${source.url}`}
            src={source.url}
            type={source.mimeType}
          />
        ))}
      </audio>
    </div>
  );
}

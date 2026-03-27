import { useEffect, useMemo } from "react";
import { useMediaPlyr } from "../hooks/useMediaPlyr.ts";
import { orderSources } from "../utils/orderSources.ts";
import { ControlBar } from "./controls/ControlBar.tsx";
import type { VideoPlayerProps } from "../types/index.ts";
import "../styles/media-plyr.css";

export function VideoPlayer({
  config,
  className,
  onReady,
  onError,
}: VideoPlayerProps) {
  const { ref, state, error, ready, player } = useMediaPlyr(config);

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

  if (error && error.code !== 1001) {
    return (
      <div className={`media-plyr media-plyr--error ${className ?? ""}`}>
        <div className="media-plyr__error-overlay">
          <div className="media-plyr__error-icon">&#9888;</div>
          <p className="media-plyr__error-message">
            {error.message || "Failed to load media"}
          </p>
          <button
            className="media-plyr__error-retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
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

        <ControlBar player={player} state={state} />
      </div>
    </div>
  );
}

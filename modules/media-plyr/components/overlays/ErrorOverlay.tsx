import type { MediaPlyrError } from "../../types/index.ts";

interface ErrorOverlayProps {
  error: MediaPlyrError;
  onRetry?: () => void;
}

interface ErrorCopy {
  heading: string;
  message?: string;
  showRetry?: boolean;
}

/**
 * Translates error codes into friendly, action-oriented copy.
 *
 * Player-internal codes:
 *   1000  Browser unsupported (Shaka can't run here)
 *   1002  No sources provided
 *   1003  No HLS/DASH manifest in sources (progressive not supported)
 *
 * HTML5 MediaError codes: 1–4
 * Shaka error ranges: 1xxx network, 3xxx media, 4xxx manifest, 6xxx DRM,
 *                     7xxx player, 9xxx cast. See shaka.util.Error.Code.
 */
function getErrorCopy(error: MediaPlyrError): ErrorCopy {
  const code = error.code;

  if (code === 1000) {
    return {
      heading: "Your browser isn't supported",
      message:
        "Please update to the latest version of Chrome, Edge, Firefox, or Safari, then try again.",
      showRetry: false,
    };
  }
  if (code === 1002) {
    return { heading: "No media available", showRetry: false };
  }
  if (code === 1003) {
    return {
      heading: "Unsupported media format",
      message:
        "This stream is unavailable. Please try another title or contact support.",
      showRetry: false,
    };
  }

  // HTML MediaError codes
  if (code === 1) return { heading: "Playback aborted", showRetry: true };
  if (code === 2) {
    return {
      heading: "Network problem",
      message: "Check your connection and try again.",
      showRetry: true,
    };
  }
  if (code === 3) return { heading: "Playback error", showRetry: true };
  if (code === 4)
    return { heading: "This stream can't be played here", showRetry: false };

  // Shaka ranges
  if (code >= 1000 && code < 2000) {
    return {
      heading: "Network problem",
      message:
        "We couldn't reach the stream. Check your connection and try again.",
      showRetry: true,
    };
  }
  if (code >= 3000 && code < 4000) {
    return { heading: "Playback error", showRetry: true };
  }
  if (code >= 4000 && code < 5000) {
    return { heading: "Stream unavailable", showRetry: true };
  }
  if (code >= 6000 && code < 7000) {
    return {
      heading: "Protected content",
      message:
        "This content is DRM-protected and can't be played on this device.",
      showRetry: false,
    };
  }

  return { heading: "Playback error", showRetry: true };
}

export function ErrorOverlay({ error, onRetry }: ErrorOverlayProps) {
  const copy = getErrorCopy(error);
  const message =
    copy.message ?? error.message ?? "An unexpected error occurred";
  const canRetry = copy.showRetry !== false && !!onRetry;

  return (
    <div className="media-plyr__error-overlay" role="alert">
      <div className="media-plyr__error-icon" aria-hidden="true">
        &#9888;
      </div>
      <p className="media-plyr__error-heading">{copy.heading}</p>
      <p className="media-plyr__error-message">{message}</p>
      {canRetry && (
        <button
          className="media-plyr__error-retry"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      )}
    </div>
  );
}

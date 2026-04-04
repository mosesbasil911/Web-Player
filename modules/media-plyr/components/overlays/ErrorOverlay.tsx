import type { MediaPlyrError } from "../../types/index.ts";

interface ErrorOverlayProps {
  error: MediaPlyrError;
  onRetry?: () => void;
}

function getErrorHeading(error: MediaPlyrError): string {
  const code = error.code;

  if (code === 1000) return "Unsupported Browser";
  if (code === 1002) return "No Media Source";

  // HTML MediaError codes
  if (code === 1) return "Playback Aborted";
  if (code === 2) return "Network Error";
  if (code === 3) return "Decode Error";
  if (code === 4) return "Source Not Supported";

  // Shaka HTTP errors (1xxx range)
  if (code >= 1000 && code < 2000) return "Network Error";
  // Shaka manifest errors (4xxx)
  if (code >= 4000 && code < 5000) return "Stream Error";
  // Shaka DRM errors (6xxx)
  if (code >= 6000 && code < 7000) return "Content Protected";

  return "Playback Error";
}

export function ErrorOverlay({ error, onRetry }: ErrorOverlayProps) {
  const heading = getErrorHeading(error);

  return (
    <div className="media-plyr__error-overlay" role="alert">
      <div className="media-plyr__error-icon" aria-hidden="true">
        &#9888;
      </div>
      <p className="media-plyr__error-heading">{heading}</p>
      <p className="media-plyr__error-message">
        {error.message || "An unexpected error occurred"}
      </p>
      {onRetry && (
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

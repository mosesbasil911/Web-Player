interface BufferingOverlayProps {
  visible: boolean;
}

export function BufferingOverlay({ visible }: BufferingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="media-plyr__buffering-overlay" aria-live="polite">
      <div className="media-plyr__spinner" role="status">
        <span className="media-plyr__sr-only">Buffering…</span>
      </div>
    </div>
  );
}

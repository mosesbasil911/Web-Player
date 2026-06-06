import { useEffect, useRef, useState } from 'react';
import { AdsManager } from '../../integrations/AdsManager.ts';
import type {
  MediaPlyrInstance,
  AdsConfig,
  AdInfo,
  AdProgressEvent,
} from '../../types/index.ts';

export interface AdOverlayProps {
  player: MediaPlyrInstance | null;
  adsConfig?: AdsConfig;
  /**
   * Called whenever a linear ad is playing or stops, so the host can hide its
   * own controls / poster while an ad blocks the content.
   */
  onAdActiveChange?: (active: boolean) => void;
}

/**
 * Renders the Google IMA ad container and a lightweight status badge
 * (advertiser label + skip countdown). IMA paints the actual ad UI — the
 * clickthrough, the real skip button, etc. — into `media-plyr__ad-container`;
 * this component layers a small "Ad" affordance on top and owns the
 * `AdsManager` lifecycle (mirrors how `CastButton` owns `CastManager`).
 *
 * Works for both `<video>` and `<audio>` players: for audio the container is
 * an invisible click-surface (IMA still needs a DOM node to attach to and to
 * route clickthroughs), so the badge is the only visible affordance.
 */
export function AdOverlay({
  player,
  adsConfig,
  onAdActiveChange,
}: AdOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<AdsManager | null>(null);
  const onActiveRef = useRef(onAdActiveChange);
  useEffect(() => {
    onActiveRef.current = onAdActiveChange;
  }, [onAdActiveChange]);

  const [adActive, setAdActive] = useState(false);
  const [adInfo, setAdInfo] = useState<AdInfo | null>(null);
  const [progress, setProgress] = useState<AdProgressEvent | null>(null);

  const tagUrl = adsConfig?.tagUrl;

  useEffect(() => {
    if (!player || !tagUrl || !adsConfig) return;
    const container = containerRef.current;
    if (!container) return;
    if (!AdsManager.isSupported()) return;

    const mgr = new AdsManager(player, adsConfig, container);
    managerRef.current = mgr;

    const setActive = (active: boolean) => {
      setAdActive(active);
      onActiveRef.current?.(active);
    };

    const handleStart = (data?: unknown) => {
      setAdInfo((data as AdInfo) ?? null);
      setActive(true);
    };
    const handleProgress = (data?: unknown) => {
      setProgress((data as AdProgressEvent) ?? null);
    };
    const clear = () => {
      setActive(false);
      setAdInfo(null);
      setProgress(null);
    };

    mgr.on('adstart', handleStart);
    mgr.on('adprogress', handleProgress);
    mgr.on('adend', clear);
    mgr.on('adskip', clear);
    mgr.on('aderror', clear);
    mgr.on('adbreakend', clear);

    mgr.init();

    return () => {
      mgr.destroy();
      managerRef.current = null;
      clear();
    };
  }, [player, adsConfig, tagUrl]);

  // Keep the ad sized to the container across fullscreen / layout changes.
  useEffect(() => {
    const onFullscreen = () => managerRef.current?.resize();
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const showSkipCountdown =
    adInfo?.skippable && progress != null && progress.skipTimeRemaining > 0;

  const remainingLabel =
    progress != null && progress.duration >= 0 && progress.currentTime >= 0
      ? formatCountdown(progress.duration - progress.currentTime)
      : null;

  return (
    <div
      className={`media-plyr__ad${adActive ? ' media-plyr__ad--active' : ''}`}
      data-ad-active={adActive ? 'true' : 'false'}
    >
      <div ref={containerRef} className="media-plyr__ad-container" />

      {adActive && (
        <div className="media-plyr__ad-badge" aria-live="polite">
          <span className="media-plyr__ad-badge-label">
            Ad
            {adInfo && adInfo.podCount > 1
              ? ` ${adInfo.podPosition} of ${adInfo.podCount}`
              : ''}
          </span>
          {remainingLabel && (
            <span className="media-plyr__ad-badge-time">{remainingLabel}</span>
          )}
          {showSkipCountdown && (
            <span className="media-plyr__ad-badge-skip">
              Skip in {Math.ceil(progress!.skipTimeRemaining)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.ceil(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

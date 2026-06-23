import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaPlyr } from '../hooks/useMediaPlyr.ts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts';
import { useGlobalMute } from '../hooks/useGlobalMute.ts';
import { PlaybackMemory } from '../core/PlaybackMemory.ts';
import { MediaSessionManager } from '../integrations/MediaSessionManager.ts';
import { ControlBar } from './controls/ControlBar.tsx';
import { ErrorOverlay } from './overlays/ErrorOverlay.tsx';
import { BufferingOverlay } from './overlays/BufferingOverlay.tsx';
import { AdOverlay } from './overlays/AdOverlay.tsx';
import type { VideoPlayerProps } from '../types/index.ts';
import '../styles/media-plyr.css';

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
  const [loop, setLoop] = useState(() => !!config.loop);
  const [adActive, setAdActive] = useState(false);

  const resolvedConfig = useMemo(() => {
    let nextConfig = config;

    if (memoryConfig?.enabled) {
      const memory = new PlaybackMemory(memoryConfig);
      const saved = memory.getSavedPosition(mediaId);
      if (
        saved !== null &&
        (config.startTime === undefined || config.startTime === 0)
      ) {
        nextConfig = { ...config, startTime: saved };
      }
    }

    return { ...nextConfig, loop };
  }, [config, memoryConfig, mediaId, loop]);

  const { ref, state, error, ready, player } = useMediaPlyr(resolvedConfig);

  useKeyboardShortcuts(player, state, config.seekStep);

  const { muted: globalMuted } = useGlobalMute();
  useEffect(() => {
    if (!player) return;
    if (state.muted !== globalMuted) {
      player.setMuted(globalMuted);
    }
  }, [player, globalMuted, state.muted]);

  useEffect(() => {
    if (!player) return;
    player.setLoop(loop);
  }, [player, loop]);

  useEffect(() => {
    if (!memoryConfig?.enabled || !player?.videoElement) return;

    const memory = new PlaybackMemory(memoryConfig);
    memory.attach(player.videoElement as HTMLMediaElement, mediaId);
    return () => memory.detach();
  }, [player, memoryConfig, mediaId]);

  // Fire as soon as the player instance is created (attach resolved), not only
  // when the first manifest finishes loading. This ensures the parent holds a
  // live player reference even when the initial load fails (e.g. no network)
  // so the OfflinePanel's Play buttons stay enabled.
  useEffect(() => {
    if (player && onReady) {
      onReady(player);
    }
  }, [player, onReady]);

  const sessionRef = useRef<MediaSessionManager | null>(null);
  const sessionMetadataRef = useRef({
    title: config.title,
    poster: config.poster,
  });

  useEffect(() => {
    if (!player) return;

    const session = new MediaSessionManager(player, {
      onPrev: hasPrev ? onPrev : undefined,
      onNext: hasNext ? onNext : undefined,
    });
    sessionRef.current = session;

    if (!session.isSupported()) return;

    const applyMetadata = () => {
      session.setMetadata({
        title: sessionMetadataRef.current.title ?? 'Video',
        artwork: sessionMetadataRef.current.poster,
      });
    };

    session.bindActionHandlers();
    session.startPositionUpdates();
    applyMetadata();

    const handlePlay = () => {
      session.setPlaybackState('playing');
      applyMetadata();
    };
    const handlePause = () => session.setPlaybackState('paused');
    const handleEnded = () => {
      if (player.isLoop()) return;
      session.setPlaybackState('paused');
    };

    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('ended', handleEnded);

    return () => {
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('ended', handleEnded);
      session.destroy();
      sessionRef.current = null;
    };
  }, [player, hasPrev, hasNext, onPrev, onNext]);

  useEffect(() => {
    sessionMetadataRef.current = { title: config.title, poster: config.poster };
    sessionRef.current?.setMetadata({
      title: config.title ?? 'Video',
      artwork: config.poster,
    });
  }, [player, config.title, config.poster]);

  useEffect(() => {
    if (error?.severity === 'fatal' && onError) {
      onError({
        code: error.code,
        message: error.message,
        severity: error.severity,
      });
    }
  }, [error, onError]);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const hasFatalError = error?.severity === 'fatal';
  const isBuffering = ready && state.waiting && !state.paused && !state.ended;

  // Keep the <video> element mounted even when there is a fatal error.
  // Unmounting it would destroy the underlying Shaka player, nulling out
  // the player reference that the OfflinePanel needs to trigger offline
  // playback. Instead, render the error overlay on top of the video layer.
  return (
    <div className={`media-plyr media-plyr--video ${className ?? ''}`}>
      <div
        className="media-plyr__container"
        data-ad-active={adActive ? 'true' : 'false'}
      >
        <video
          ref={ref}
          className="media-plyr__video"
          poster={config.poster}
          muted={!!config.muted}
          playsInline
          crossOrigin={config.crossOrigin}
          aria-label={config.title}
        />

        {!ready && !hasFatalError && !adActive && (
          <div className="media-plyr__loading-overlay">
            <div className="media-plyr__spinner" />
          </div>
        )}

        <BufferingOverlay visible={isBuffering && !adActive} />

        <AdOverlay
          player={player}
          adsConfig={config.ads}
          onAdActiveChange={setAdActive}
        />

        {hasFatalError && (
          <ErrorOverlay
            error={{
              code: error.code,
              message: error.message,
              severity: error.severity,
            }}
            onRetry={handleRetry}
          />
        )}

        {!adActive && (
          <ControlBar
            player={player}
            state={state}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={onPrev}
            onNext={onNext}
            loop={loop}
            onLoopChange={setLoop}
            castConfig={config.cast}
          />
        )}
      </div>
    </div>
  );
}

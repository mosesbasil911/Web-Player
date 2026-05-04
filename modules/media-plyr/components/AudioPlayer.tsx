import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useMediaPlyr } from '../hooks/useMediaPlyr.ts';
import { useQueue } from '../hooks/useQueue.ts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts';
import { useGlobalMute } from '../hooks/useGlobalMute.ts';
import { PlaybackMemory } from '../core/PlaybackMemory.ts';
import { CrossfadeEngine } from '../core/CrossfadeEngine.ts';
import { MediaSessionManager } from '../integrations/MediaSessionManager.ts';
import { PlayPauseButton } from './controls/PlayPauseButton.tsx';
import { SeekBar } from './controls/SeekBar.tsx';
import { VolumeControl } from './controls/VolumeControl.tsx';
import { MuteButton } from './controls/MuteButton.tsx';
import { TimeDisplay } from './controls/TimeDisplay.tsx';
import { PrevNextButtons } from './controls/PrevNextButtons.tsx';
import { RepeatShuffleButtons } from './controls/RepeatShuffleButtons.tsx';
import { SpeedSelector } from './controls/SpeedSelector.tsx';
import { ErrorOverlay } from './overlays/ErrorOverlay.tsx';
import { LyricsPanel } from './LyricsPanel.tsx';
import { formatTime } from '../utils/formatTime.ts';
import type {
  AudioPlayerProps,
  MediaPlyrConfig,
  MediaTrack,
  RepeatMode,
} from '../types/index.ts';
import '../styles/media-plyr.css';

function buildConfigFromTrack(
  track: MediaTrack,
  base?: Partial<MediaPlyrConfig>,
): MediaPlyrConfig {
  return {
    kind: 'audio',
    sources: track.sources,
    title: track.title,
    poster: track.poster ?? track.artwork,
    subtitles: track.subtitles,
    ...base,
  };
}

export function AudioPlayer({
  config,
  playlist,
  className,
  onReady,
  onError,
}: AudioPlayerProps) {
  const tracks = useMemo<MediaTrack[]>(() => {
    if (playlist && playlist.length > 0) return playlist;
    return [
      {
        kind: config.kind,
        sources: config.sources,
        title: config.title,
        artist: undefined,
        artwork: config.poster,
        poster: config.poster,
        subtitles: config.subtitles,
      },
    ];
  }, [playlist, config]);

  const queue = useQueue(tracks);
  const { state: queueState, currentTrack } = queue;

  const hasNavigatedRef = useRef(false);
  const prevIndexRef = useRef(queueState.currentIndex);
  if (prevIndexRef.current !== queueState.currentIndex) {
    hasNavigatedRef.current = true;
    prevIndexRef.current = queueState.currentIndex;
  }

  // After a crossfade, the primary needs to resume the new track at the
  // secondary's playhead, not from 0. We store it in state so it remains
  // stable across subsequent re-renders (e.g. user changes the crossfade
  // duration picker). It is cleared only on explicit user navigation, not
  // on arbitrary config changes — that prevents config-change re-renders
  // from dropping the startTime back to undefined and triggering a reload.
  const [handoffStartTime, setHandoffStartTime] = useState<number | null>(null);
  // Set to true by the crossfade before it calls queue.next(), consumed by
  // the [queueState.currentIndex] effect so it knows NOT to clear the handoff.
  const crossfadeAdvancedRef = useRef(false);

  const activeConfig = useMemo<MediaPlyrConfig>(() => {
    if (!currentTrack) return config;
    return buildConfigFromTrack(currentTrack, {
      autoplay: hasNavigatedRef.current,
      volume: config.volume,
      muted: config.muted,
      crossOrigin: config.crossOrigin,
      playbackMemory: config.playbackMemory,
      abr: config.abr,
      streaming: config.streaming,
      preferredOrder: config.preferredOrder,
      crossfade: config.crossfade,
    });
    // queueState.currentIndex drives recomputation when the track changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, config, queueState.currentIndex]);

  const memoryConfig = activeConfig.playbackMemory;
  const mediaId = activeConfig.sources[0]?.url ?? activeConfig.title;

  const resolvedConfig = useMemo(() => {
    let next = activeConfig;
    if (memoryConfig?.enabled) {
      const memory = new PlaybackMemory(memoryConfig);
      const saved = memory.getSavedPosition(mediaId);
      if (
        saved !== null &&
        (activeConfig.startTime === undefined || activeConfig.startTime === 0)
      ) {
        next = { ...activeConfig, startTime: saved };
      }
    }
    // Crossfade hand-off takes precedence over saved position so the new
    // track resumes right where the secondary element left off.
    if (handoffStartTime !== null) {
      next = { ...next, startTime: handoffStartTime };
    }
    return next;
  }, [activeConfig, memoryConfig, mediaId, handoffStartTime]);

  const { ref, state, error, ready, player } = useMediaPlyr(resolvedConfig);

  useKeyboardShortcuts(player, state);

  const { muted: globalMuted } = useGlobalMute();
  useEffect(() => {
    if (!player) return;
    if (state.muted !== globalMuted) {
      player.setMuted(globalMuted);
    }
  }, [player, globalMuted, state.muted]);

  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const endedHandledRef = useRef(false);
  const queueFinishedRef = useRef(false);

  // Auto-close the lyrics panel when navigating to a track that has none,
  // and re-open it on a track that does — but only on track CHANGE, not
  // on every render, so the user's manual toggle is respected.
  const lyricsTrackKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = currentTrack?.lyrics?.src ?? null;
    if (key === lyricsTrackKeyRef.current) return;
    lyricsTrackKeyRef.current = key;
    if (!key) setLyricsOpen(false);
  }, [currentTrack]);

  useEffect(() => {
    if (!memoryConfig?.enabled || !player?.videoElement) return;
    const memory = new PlaybackMemory(memoryConfig);
    memory.attach(player.videoElement as HTMLMediaElement, mediaId);
    return () => memory.detach();
  }, [player, memoryConfig, mediaId]);

  // Auto-advance on track end.
  //
  // `endedHandledRef` guards against a double-advance race during a crossfade
  // hand-off. The crossfade sets it to `true` before the overlap starts so the
  // primary's natural `ended` event (which fires DURING the crossfade) can't
  // also advance the queue. We reset it on the *play* event of the NEW track
  // rather than on `currentIndex` change — resetting on index change would
  // re-open the gate before a late-dispatched `ended` from the old track is
  // processed, causing a second `queue.next()` and skipping a track.
  useEffect(() => {
    if (!player) return;

    const handleEnded = () => {
      if (endedHandledRef.current) return;
      endedHandledRef.current = true;

      if (queueState.repeat === 'one') {
        player.seek(0);
        player.play();
        return;
      }

      const nextTrack = queue.next();
      if (!nextTrack && queueState.repeat === 'none') {
        queueFinishedRef.current = true;
      }
    };

    const handlePlay = () => {
      endedHandledRef.current = false;
      if (queueFinishedRef.current) {
        queueFinishedRef.current = false;
        player.pause();
        queue.skipTo(0);
      }
    };

    player.on('ended', handleEnded);
    player.on('play', handlePlay);
    return () => {
      player.off('ended', handleEnded);
      player.off('play', handlePlay);
    };
  }, [player, queue, queueState.repeat, queueState.currentIndex]);

  // OS-level media controls (lock screen, hardware media keys, etc.).
  // We keep a single MediaSessionManager per player and update its metadata
  // when the current track changes.
  const sessionRef = useRef<MediaSessionManager | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!player) return;
    const session = new MediaSessionManager(player, {
      onPrev: () => {
        if (stateRef.current.currentTime > 3) player.seek(0);
        else queueRef.current.prev();
      },
      onNext: () => queueRef.current.next(),
    });
    sessionRef.current = session;
    if (!session.isSupported()) return;
    session.bindActionHandlers();
    session.startPositionUpdates();

    const handlePlay = () => session.setPlaybackState('playing');
    const handlePause = () => session.setPlaybackState('paused');
    const handleEndedSession = () => session.setPlaybackState('paused');
    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('ended', handleEndedSession);

    return () => {
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('ended', handleEndedSession);
      session.destroy();
      sessionRef.current = null;
    };
  }, [player]);

  useEffect(() => {
    sessionRef.current?.setMetadataFromTrack(currentTrack);
  }, [currentTrack]);

  // ---------------------------------------------------------------------
  // Pre-buffering + crossfade
  // ---------------------------------------------------------------------
  const crossfadeConfig = activeConfig.crossfade;
  const crossfadeEnabled = !!crossfadeConfig?.enabled;
  const crossfadeDurationMs = crossfadeConfig?.durationMs ?? 4000;

  const engineRef = useRef<CrossfadeEngine | null>(null);
  const crossfadeFiredRef = useRef(false);
  const playerRef = useRef(player);
  playerRef.current = player;

  // Compute the upcoming track (without mutating the queue) so we can
  // pre-buffer it and feed it to the crossfade engine.
  const nextTrack = useMemo<MediaTrack | null>(() => {
    if (queueState.tracks.length === 0) return null;
    if (queueState.repeat === 'one') return null;
    const idx = queueState.currentIndex;
    if (idx + 1 < queueState.tracks.length) return queueState.tracks[idx + 1];
    if (queueState.repeat === 'all') return queueState.tracks[0];
    return null;
  }, [queueState.tracks, queueState.currentIndex, queueState.repeat]);

  const nextConfig = useMemo<MediaPlyrConfig | null>(() => {
    if (!nextTrack) return null;
    return buildConfigFromTrack(nextTrack, {
      autoplay: false,
      crossOrigin: config.crossOrigin,
      preferredOrder: config.preferredOrder,
      abr: config.abr,
      streaming: config.streaming,
    });
  }, [nextTrack, config]);

  // Reset per-track guards whenever the active track changes.
  // Only clear the handoff startTime for user-driven navigation; crossfade
  // hand-offs set crossfadeAdvancedRef before advancing the queue so we know
  // to leave the handoff position in place for the new track's first load.
  useEffect(() => {
    crossfadeFiredRef.current = false;
    if (!crossfadeAdvancedRef.current) {
      setHandoffStartTime(null);
    }
    crossfadeAdvancedRef.current = false;
  }, [queueState.currentIndex]);

  // Lazily create the engine the first time crossfade is enabled. Tear it
  // down on unmount or when crossfade is turned off.
  useEffect(() => {
    if (!crossfadeEnabled) return;
    const engine = new CrossfadeEngine();
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [crossfadeEnabled]);

  // Pre-buffer the next track once the current one has loaded.
  useEffect(() => {
    if (!crossfadeEnabled || !ready || !nextConfig) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.prebuffer(nextConfig);
  }, [crossfadeEnabled, ready, nextConfig]);

  // Watch the playhead. When the remaining time falls inside the crossfade
  // window, kick off the overlap.
  useEffect(() => {
    if (!crossfadeEnabled) return;
    if (!player || !nextConfig) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (crossfadeFiredRef.current) return;

    const remaining = state.duration - state.currentTime;
    const windowSec = crossfadeDurationMs / 1000;
    if (
      !Number.isFinite(state.duration) ||
      state.duration <= 0 ||
      remaining > windowSec ||
      remaining <= 0 ||
      state.paused ||
      state.ended
    ) {
      return;
    }

    crossfadeFiredRef.current = true;
    // Block the regular `ended`-driven auto-advance — the crossfade owns
    // the queue advance from here on out.
    endedHandledRef.current = true;
    const primaryEl = player.videoElement as HTMLAudioElement | null;
    if (!primaryEl) return;

    const targetVolume = state.volume;
    void engine
      .startCrossfade(primaryEl, crossfadeDurationMs, targetVolume)
      .then(({ secondaryCurrentTime }) => {
        // Mark the queue advance as crossfade-driven so the
        // [queueState.currentIndex] effect doesn't wipe the handoff time.
        crossfadeAdvancedRef.current = true;
        setHandoffStartTime(secondaryCurrentTime);

        // Mute the primary so its autoplay-after-load doesn't double up
        // with the still-audible secondary.
        primaryEl.volume = 0;
        primaryEl.pause();

        const advancingPlayer = playerRef.current;
        const advance = () => {
          queueRef.current.next();
        };
        advance();

        // Once the new track is loaded on the primary, fade the secondary
        // out and restore the primary's volume so the listener experiences
        // a seamless continuation.
        const finalize = () => {
          if (!advancingPlayer) return;
          const el = advancingPlayer.videoElement as HTMLAudioElement | null;
          if (el) el.volume = targetVolume;
          void engine.fadeOutSecondary(Math.min(400, crossfadeDurationMs));
        };
        if (advancingPlayer) {
          const handleLoaded = () => {
            advancingPlayer.off('loaded', handleLoaded);
            finalize();
          };
          advancingPlayer.on('loaded', handleLoaded);
          // Fallback in case the load races ahead.
          window.setTimeout(finalize, 1500);
        } else {
          finalize();
        }
      });
  }, [
    crossfadeEnabled,
    crossfadeDurationMs,
    nextConfig,
    player,
    state.currentTime,
    state.duration,
    state.paused,
    state.ended,
    state.volume,
  ]);

  useEffect(() => {
    if (ready && player && onReady) onReady(player);
  }, [ready, player, onReady]);

  useEffect(() => {
    if (error && error.code !== 1001 && onError) {
      onError({ code: error.code, message: error.message, severity: 'fatal' });
    }
  }, [error, onError]);

  const handleRetry = useCallback(() => window.location.reload(), []);
  const handlePrev = useCallback(() => {
    if (player && state.currentTime > 3) {
      player.seek(0);
    } else {
      queue.prev();
    }
  }, [player, state.currentTime, queue]);
  const handleNext = useCallback(() => queue.next(), [queue]);
  const handleRepeatChange = useCallback(
    (mode: RepeatMode) => queue.setRepeat(mode),
    [queue],
  );
  const handleShuffleChange = useCallback(
    (on: boolean) => queue.setShuffle(on),
    [queue],
  );
  const handleSkipTo = useCallback(
    (index: number) => queue.skipTo(index),
    [queue],
  );

  const hasFatalError = error && error.code !== 1001;

  if (hasFatalError) {
    return (
      <div
        className={`media-plyr media-plyr--audio media-plyr--error ${className ?? ''}`}
      >
        <ErrorOverlay
          error={{
            code: error.code,
            message: error.message,
            severity: 'fatal',
          }}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  const artwork =
    currentTrack?.artwork ?? currentTrack?.poster ?? activeConfig.poster;
  const title = currentTrack?.title ?? activeConfig.title;
  const artist = currentTrack?.artist;
  const isPlaylist = tracks.length > 1;

  return (
    <div className={`media-plyr media-plyr--audio ${className ?? ''}`}>
      <audio
        ref={ref}
        aria-label={title}
        crossOrigin={activeConfig.crossOrigin}
        preload="metadata"
      />

      <div className="media-plyr-audio">
        {/* Track Info Row */}
        <div className="media-plyr-audio__info">
          {artwork && (
            <div className="media-plyr-audio__artwork">
              <img src={artwork} alt={title} />
            </div>
          )}
          <div className="media-plyr-audio__meta">
            <div className="media-plyr-audio__title" title={title}>
              {title}
            </div>
            {artist && (
              <div className="media-plyr-audio__artist" title={artist}>
                {artist}
              </div>
            )}
          </div>
        </div>

        {/* Seek Bar */}
        <div className="media-plyr-audio__seek">
          <SeekBar player={player} state={state} />
        </div>

        {/* Controls */}
        <div className="media-plyr-audio__controls">
          <div className="media-plyr-audio__controls-left">
            <RepeatShuffleButtons
              repeat={queueState.repeat}
              shuffle={queueState.shuffle}
              onRepeatChange={handleRepeatChange}
              onShuffleChange={handleShuffleChange}
            />
          </div>

          <div className="media-plyr-audio__controls-center">
            <PrevNextButtons
              hasPrev={queue.hasPrev}
              hasNext={queue.hasNext}
              onPrev={handlePrev}
              onNext={handleNext}
            />
            <PlayPauseButton player={player} state={state} />
          </div>

          <div className="media-plyr-audio__controls-right">
            <TimeDisplay state={state} />
            <MuteButton player={player} state={state} />
            <VolumeControl player={player} state={state} />
            <SpeedSelector player={player} state={state} />
            {currentTrack?.lyrics && (
              <button
                className={`media-plyr__btn media-plyr__btn--lyrics${lyricsOpen ? ' media-plyr__btn--active' : ''}`}
                onClick={() => setLyricsOpen((v) => !v)}
                aria-label={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
                aria-pressed={lyricsOpen}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                  <path d="M3 9h6" />
                </svg>
              </button>
            )}
            {isPlaylist && (
              <button
                className={`media-plyr__btn media-plyr__btn--queue${queueOpen ? ' media-plyr__btn--active' : ''}`}
                onClick={() => setQueueOpen(!queueOpen)}
                aria-label={queueOpen ? 'Hide queue' : 'Show queue'}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Queue Panel */}
        {isPlaylist && queueOpen && (
          <div className="media-plyr-audio__queue">
            <div className="media-plyr-audio__queue-header">
              <span className="media-plyr-audio__queue-title">Queue</span>
              <span className="media-plyr-audio__queue-count">
                {queueState.currentIndex + 1} / {queueState.tracks.length}
              </span>
            </div>
            <ul className="media-plyr-audio__queue-list" role="list">
              {queueState.tracks.map((track, i) => {
                const isActive = i === queueState.currentIndex;
                return (
                  <li
                    key={`${track.title}-${i}`}
                    className={`media-plyr-audio__queue-item${isActive ? ' media-plyr-audio__queue-item--active' : ''}`}
                    role="listitem"
                  >
                    <button
                      className="media-plyr-audio__queue-item-btn"
                      onClick={() => handleSkipTo(i)}
                      aria-label={`Play ${track.title}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span className="media-plyr-audio__queue-item-index">
                        {isActive ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z" />
                          </svg>
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </span>
                      <span className="media-plyr-audio__queue-item-info">
                        <span className="media-plyr-audio__queue-item-title">
                          {track.title}
                        </span>
                        {track.artist && (
                          <span className="media-plyr-audio__queue-item-artist">
                            {track.artist}
                          </span>
                        )}
                      </span>
                      {track.duration !== undefined && (
                        <span className="media-plyr-audio__queue-item-duration">
                          {formatTime(track.duration)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <LyricsPanel
          lyrics={currentTrack?.lyrics ?? null}
          currentTime={state.currentTime}
          visible={lyricsOpen}
        />

        {/* Loading indicator */}
        {!ready && (
          <div className="media-plyr-audio__loading">
            <div className="media-plyr__spinner" />
          </div>
        )}
      </div>
    </div>
  );
}

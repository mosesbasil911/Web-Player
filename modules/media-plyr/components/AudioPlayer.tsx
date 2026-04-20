import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useMediaPlyr } from "../hooks/useMediaPlyr.ts";
import { useQueue } from "../hooks/useQueue.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { PlaybackMemory } from "../core/PlaybackMemory.ts";
import { PlayPauseButton } from "./controls/PlayPauseButton.tsx";
import { SeekBar } from "./controls/SeekBar.tsx";
import { VolumeControl } from "./controls/VolumeControl.tsx";
import { MuteButton } from "./controls/MuteButton.tsx";
import { TimeDisplay } from "./controls/TimeDisplay.tsx";
import { PrevNextButtons } from "./controls/PrevNextButtons.tsx";
import { RepeatShuffleButtons } from "./controls/RepeatShuffleButtons.tsx";
import { SpeedSelector } from "./controls/SpeedSelector.tsx";
import { ErrorOverlay } from "./overlays/ErrorOverlay.tsx";
import { formatTime } from "../utils/formatTime.ts";
import type {
  AudioPlayerProps,
  MediaPlyrConfig,
  MediaTrack,
  RepeatMode,
} from "../types/index.ts";
import "../styles/media-plyr.css";

function buildConfigFromTrack(
  track: MediaTrack,
  base?: Partial<MediaPlyrConfig>,
): MediaPlyrConfig {
  return {
    kind: "audio",
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
    });
    // queueState.currentIndex drives recomputation when the track changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, config, queueState.currentIndex]);

  const memoryConfig = activeConfig.playbackMemory;
  const mediaId = activeConfig.sources[0]?.url ?? activeConfig.title;

  const resolvedConfig = useMemo(() => {
    if (!memoryConfig?.enabled) return activeConfig;
    const memory = new PlaybackMemory(memoryConfig);
    const saved = memory.getSavedPosition(mediaId);
    if (
      saved !== null &&
      (activeConfig.startTime === undefined || activeConfig.startTime === 0)
    ) {
      return { ...activeConfig, startTime: saved };
    }
    return activeConfig;
  }, [activeConfig, memoryConfig, mediaId]);

  const { ref, state, error, ready, player } = useMediaPlyr(resolvedConfig);

  useKeyboardShortcuts(player, state);

  const [queueOpen, setQueueOpen] = useState(false);
  const endedHandledRef = useRef(false);
  const queueFinishedRef = useRef(false);

  useEffect(() => {
    if (!memoryConfig?.enabled || !player?.videoElement) return;
    const memory = new PlaybackMemory(memoryConfig);
    memory.attach(player.videoElement as HTMLMediaElement, mediaId);
    return () => memory.detach();
  }, [player, memoryConfig, mediaId]);

  // Auto-advance on track end
  useEffect(() => {
    if (!player) return;
    endedHandledRef.current = false;

    const handleEnded = () => {
      if (endedHandledRef.current) return;
      endedHandledRef.current = true;

      if (queueState.repeat === "one") {
        player.seek(0);
        player.play();
        return;
      }

      const nextTrack = queue.next();
      if (!nextTrack && queueState.repeat === "none") {
        queueFinishedRef.current = true;
      }
    };

    const handlePlay = () => {
      if (queueFinishedRef.current) {
        queueFinishedRef.current = false;
        player.pause();
        queue.skipTo(0);
      }
    };

    player.on("ended", handleEnded);
    player.on("play", handlePlay);
    return () => {
      player.off("ended", handleEnded);
      player.off("play", handlePlay);
    };
  }, [player, queue, queueState.repeat, queueState.currentIndex]);

  useEffect(() => {
    if (ready && player && onReady) onReady(player);
  }, [ready, player, onReady]);

  useEffect(() => {
    if (error && error.code !== 1001 && onError) {
      onError({ code: error.code, message: error.message, severity: "fatal" });
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

  const artwork =
    currentTrack?.artwork ?? currentTrack?.poster ?? activeConfig.poster;
  const title = currentTrack?.title ?? activeConfig.title;
  const artist = currentTrack?.artist;
  const isPlaylist = tracks.length > 1;

  return (
    <div className={`media-plyr media-plyr--audio ${className ?? ""}`}>
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
            {isPlaylist && (
              <button
                className={`media-plyr__btn media-plyr__btn--queue${queueOpen ? " media-plyr__btn--active" : ""}`}
                onClick={() => setQueueOpen(!queueOpen)}
                aria-label={queueOpen ? "Hide queue" : "Show queue"}
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
                    className={`media-plyr-audio__queue-item${isActive ? " media-plyr-audio__queue-item--active" : ""}`}
                    role="listitem"
                  >
                    <button
                      className="media-plyr-audio__queue-item-btn"
                      onClick={() => handleSkipTo(i)}
                      aria-label={`Play ${track.title}`}
                      aria-current={isActive ? "true" : undefined}
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

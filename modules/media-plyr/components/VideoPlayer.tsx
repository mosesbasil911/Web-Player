import { useEffect } from 'react';
import { useMediaPlyr } from '../hooks/useMediaPlyr.ts';
import { formatTime } from '../utils/formatTime.ts';
import type { VideoPlayerProps } from '../types/index.ts';
import '../styles/media-plyr.css';

export function VideoPlayer({ config, className, onReady, onError }: VideoPlayerProps) {
  const { ref, state, error, ready, player } = useMediaPlyr(config);

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
        severity: 'fatal',
      });
    }
  }, [error, onError]);

  const handlePlayPause = () => {
    if (!player) return;
    if (state.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    player?.seek(Number(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    player?.setVolume(Number(e.target.value));
  };

  const handleMuteToggle = () => {
    player?.setMuted(!state.muted);
  };

  const handleFullscreen = () => {
    player?.toggleFullscreen();
  };

  if (error && error.code !== 1001) {
    return (
      <div className={`media-plyr media-plyr--error ${className ?? ''}`}>
        <div className="media-plyr__error-overlay">
          <div className="media-plyr__error-icon">&#9888;</div>
          <p className="media-plyr__error-message">
            {error.message || 'Failed to load media'}
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
    <div className={`media-plyr media-plyr--video ${className ?? ''}`}>
      <div className="media-plyr__container">
        <video
          ref={ref}
          className="media-plyr__video"
          poster={config.poster}
          playsInline
          aria-label={config.title}
        />

        {!ready && (
          <div className="media-plyr__loading-overlay">
            <div className="media-plyr__spinner" />
          </div>
        )}

        <div className="media-plyr__controls">
          <div className="media-plyr__controls-top">
            <input
              type="range"
              className="media-plyr__seek-bar"
              min={0}
              max={state.duration || 0}
              step={0.1}
              value={state.currentTime}
              onChange={handleSeek}
              aria-label="Seek"
            />
          </div>

          <div className="media-plyr__controls-bottom">
            <div className="media-plyr__controls-left">
              <button
                className="media-plyr__btn"
                onClick={handlePlayPause}
                aria-label={state.playing ? 'Pause' : 'Play'}
              >
                {state.playing ? '⏸' : '▶'}
              </button>

              <button
                className="media-plyr__btn"
                onClick={handleMuteToggle}
                aria-label={state.muted ? 'Unmute' : 'Mute'}
              >
                {state.muted ? '🔇' : '🔊'}
              </button>

              <input
                type="range"
                className="media-plyr__volume-bar"
                min={0}
                max={1}
                step={0.01}
                value={state.muted ? 0 : state.volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
              />

              <span className="media-plyr__time">
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
              </span>
            </div>

            <div className="media-plyr__controls-right">
              <button
                className="media-plyr__btn"
                onClick={handleFullscreen}
                aria-label={state.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {state.fullscreen ? '⊠' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

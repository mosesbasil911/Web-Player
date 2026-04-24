import type { MediaPlyrInstance, MediaTrack } from '../types/index.ts';

export interface MediaSessionMetadataInput {
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

export interface MediaSessionHandlers {
  onPrev?: () => void;
  onNext?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offset: number) => void;
  onSeekForward?: (offset: number) => void;
  onStop?: () => void;
}

const SEEK_OFFSET_SECONDS = 10;

/**
 * Bridges the player to the browser's `navigator.mediaSession` API so OS-level
 * surfaces (lock screen, notification shade, hardware media keys, smart
 * watches, Bluetooth devices) can display track metadata and control
 * playback.
 *
 * Designed to be created once per player and torn down via `destroy()`.
 */
export class MediaSessionManager {
  private player: MediaPlyrInstance;
  private handlers: MediaSessionHandlers;
  private supported: boolean;
  private boundActions: MediaSessionAction[] = [];
  private positionInterval: ReturnType<typeof setInterval> | null = null;

  constructor(player: MediaPlyrInstance, handlers: MediaSessionHandlers = {}) {
    this.player = player;
    this.handlers = handlers;
    this.supported =
      typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Push the current track's metadata to the OS. Pass any combination of
   * fields — missing values are omitted from the `MediaMetadata` payload.
   */
  setMetadata(input: MediaSessionMetadataInput | null): void {
    if (!this.supported) return;

    if (!input) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artwork = input.artwork
      ? [
          { src: input.artwork, sizes: '512x512', type: this.guessImageType(input.artwork) },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: input.title,
      artist: input.artist ?? '',
      album: input.album ?? '',
      artwork,
    });
  }

  /**
   * Convenience helper that maps a `MediaTrack` straight into the OS
   * metadata format.
   */
  setMetadataFromTrack(track: MediaTrack | null): void {
    if (!track) {
      this.setMetadata(null);
      return;
    }
    this.setMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork ?? track.poster,
    });
  }

  setPlaybackState(state: MediaSessionPlaybackState): void {
    if (!this.supported) return;
    navigator.mediaSession.playbackState = state;
  }

  /**
   * Wires browser-level action handlers (play/pause, prev/next, seek) into
   * the supplied callbacks. The player is used as a sensible default for
   * actions the host didn't override.
   */
  bindActionHandlers(): void {
    if (!this.supported) return;
    const ms = navigator.mediaSession;

    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(action, handler);
        this.boundActions.push(action);
      } catch {
        // Browser doesn't support this action — ignore.
      }
    };

    safeSet('play', () => {
      if (this.handlers.onPlay) this.handlers.onPlay();
      else this.player.play();
    });

    safeSet('pause', () => {
      if (this.handlers.onPause) this.handlers.onPause();
      else this.player.pause();
    });

    safeSet('stop', () => {
      if (this.handlers.onStop) this.handlers.onStop();
      else this.player.stop();
    });

    safeSet('previoustrack', () => {
      this.handlers.onPrev?.();
    });

    safeSet('nexttrack', () => {
      this.handlers.onNext?.();
    });

    safeSet('seekbackward', (details) => {
      const offset = details.seekOffset ?? SEEK_OFFSET_SECONDS;
      if (this.handlers.onSeekBackward) {
        this.handlers.onSeekBackward(offset);
        return;
      }
      const cur = this.player.getPlaybackState().currentTime;
      this.player.seek(Math.max(0, cur - offset));
    });

    safeSet('seekforward', (details) => {
      const offset = details.seekOffset ?? SEEK_OFFSET_SECONDS;
      if (this.handlers.onSeekForward) {
        this.handlers.onSeekForward(offset);
        return;
      }
      const cur = this.player.getPlaybackState().currentTime;
      this.player.seek(cur + offset);
    });

    safeSet('seekto', (details) => {
      if (details.seekTime === undefined || details.seekTime === null) return;
      if (this.handlers.onSeekTo) this.handlers.onSeekTo(details.seekTime);
      else this.player.seek(details.seekTime);
    });
  }

  /**
   * Periodically push position state so OS surfaces can render an accurate
   * progress bar and respond to scrub gestures.
   */
  startPositionUpdates(intervalMs = 1000): void {
    if (!this.supported || typeof navigator.mediaSession.setPositionState !== 'function') {
      return;
    }
    this.stopPositionUpdates();
    const update = () => {
      const s = this.player.getPlaybackState();
      if (!Number.isFinite(s.duration) || s.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: s.duration,
          position: Math.min(s.currentTime, s.duration),
          playbackRate: s.playbackRate || 1,
        });
      } catch {
        // Some browsers throw when called too early — safe to ignore.
      }
    };
    update();
    this.positionInterval = setInterval(update, intervalMs);
  }

  stopPositionUpdates(): void {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }

  destroy(): void {
    if (!this.supported) return;
    this.stopPositionUpdates();
    const ms = navigator.mediaSession;
    for (const action of this.boundActions) {
      try {
        ms.setActionHandler(action, null);
      } catch {
        // Ignore — cleanup is best-effort.
      }
    }
    this.boundActions = [];
    ms.metadata = null;
    ms.playbackState = 'none';
  }

  private guessImageType(url: string): string {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }
}

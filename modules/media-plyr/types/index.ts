export type MediaKind = 'video' | 'audio';

/**
 * Supported streaming manifest containers. The player is built on Shaka
 * and exclusively handles adaptive streaming manifests — progressive
 * single-file sources (mp4, webm, mp3, etc.) are not accepted.
 */
export type SourceContainer = 'hls' | 'dash';

export type MediaMimeType =
  | 'application/vnd.apple.mpegurl'
  | 'application/x-mpegURL'
  | 'application/dash+xml';

export type RepeatMode = 'none' | 'one' | 'all';

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export type AdBreakType = 'pre-roll' | 'mid-roll' | 'post-roll' | 'custom';

export interface MediaTrack {
  kind: MediaKind;
  sources: MediaSource[];
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  poster?: string;
  duration?: number;
  subtitles?: SubtitleTrack[];
  drmConfig?: DrmConfig;
  adsConfig?: AdsConfig;
}

export interface SubtitleTrack {
  src: string;
  language: string;
  label: string;
  default?: boolean;
}

export interface DrmConfig {
  servers: Record<string, string>;
  advanced?: Record<string, Record<string, unknown>>;
}

export interface AdsConfig {
  tagUrl: string;
  adBreaks?: AdBreak[];
}

export interface AdBreak {
  type: AdBreakType;
  offsetSeconds?: number;
  tagUrl: string;
}

export interface CastConfig {
  receiverApplicationId?: string;
  autoJoinPolicy?: string;
}

export interface OfflineConfig {
  enabled: boolean;
}

export interface AbrConfig {
  enabled?: boolean;
  defaultBandwidthEstimate?: number;
  restrictions?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    minBandwidth?: number;
    maxBandwidth?: number;
  };
}

export interface StreamingConfig {
  rebufferingGoal?: number;
  bufferingGoal?: number;
  bufferBehind?: number;
  /**
   * Enables Shaka's Low-Latency HLS / CMAF-LL mode. Use for live streams
   * authored with LL-HLS or LL-DASH. Safe to leave unset for VOD.
   */
  lowLatencyMode?: boolean;
  retryParameters?: {
    maxAttempts?: number;
    baseDelay?: number;
    backoffFactor?: number;
    timeout?: number;
  };
}

export interface PlaybackMemoryConfig {
  enabled: boolean;
  intervalMs?: number;
  storageKey?: string;
}

export interface CrossfadeConfig {
  enabled: boolean;
  durationMs?: number;
}

/**
 * A streaming manifest (HLS `.m3u8` or DASH `.mpd`). The manifest itself
 * declares all renditions/qualities, so quality metadata (bitrate, size,
 * resolution) lives inside the manifest — not here.
 *
 * Provide at most one HLS and one DASH entry per asset. If both are
 * provided, HLS is preferred on iOS (for native Safari playback via
 * Shaka's `src=` fallback) and DASH is preferred elsewhere.
 */
export interface MediaSource {
  container: SourceContainer;
  url: string;
  /** Optional — purely informational; never written to the DOM. */
  mimeType?: MediaMimeType;
}

export interface MediaPlyrConfig {
  kind: MediaKind;
  sources: MediaSource[];
  title: string;
  poster?: string;
  /**
   * Override the manifest selection order. Defaults to `['hls', 'dash']`.
   *
   * **iOS Safari warning:** passing `['dash', 'hls']` on iOS Safari is
   * unsupported. Shaka requires an HLS manifest to fall back to native
   * `video.src=` playback when MSE is restricted — DASH-first will likely
   * cause playback failure on that platform.
   */
  preferredOrder?: SourceContainer[];
  crossOrigin?: 'anonymous' | 'use-credentials';
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  startTime?: number;
  playbackRate?: PlaybackSpeed;

  drm?: DrmConfig;
  cast?: CastConfig;
  ads?: AdsConfig;
  offline?: OfflineConfig;
  abr?: AbrConfig;
  streaming?: StreamingConfig;
  playbackMemory?: PlaybackMemoryConfig;
  crossfade?: CrossfadeConfig;

  subtitles?: SubtitleTrack[];
}

export interface VideoPlayerProps {
  config: MediaPlyrConfig;
  className?: string;
  onReady?: (player: MediaPlyrInstance) => void;
  onError?: (error: MediaPlyrError) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export interface AudioPlayerProps {
  config: MediaPlyrConfig;
  playlist?: MediaTrack[];
  className?: string;
  onReady?: (player: MediaPlyrInstance) => void;
  onError?: (error: MediaPlyrError) => void;
}

export interface MediaPlyrError {
  code: number;
  message: string;
  severity: 'recoverable' | 'fatal';
  detail?: unknown;
}

export type MediaPlyrEventType =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'volumechange'
  | 'ratechange'
  | 'seeking'
  | 'seeked'
  | 'buffering'
  | 'loading'
  | 'loaded'
  | 'error'
  | 'destroy'
  | 'fullscreenchange'
  | 'pipchange'
  | 'trackchange'
  | 'queuechange'
  | 'repeat'
  | 'shuffle'
  | 'mute'
  | 'caststate'
  | 'adstart'
  | 'adend'
  | 'adskip'
  | 'metadata';

export type MediaPlyrEventCallback = (data?: unknown) => void;

export interface PlaybackState {
  playing: boolean;
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  pip: boolean;
  seeking: boolean;
  waiting: boolean;
}

export interface QueueState {
  tracks: MediaTrack[];
  currentIndex: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

export interface MediaPlyrInstance {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: PlaybackSpeed): void;
  toggleFullscreen(): Promise<void>;
  togglePip(): Promise<void>;
  /** Load a new manifest into the existing Shaka player without recreating it. */
  loadSource(config: MediaPlyrConfig): Promise<void>;
  destroy(): void;

  getPlaybackState(): PlaybackState;

  on(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void;
  off(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void;

  readonly videoElement: HTMLVideoElement | HTMLAudioElement | null;
}

// ---------------------------------------------------------------------------
// Raw media types — the pre-normalized shape produced by upstream services
// (CMS, encoder). Use `mapRawMediaToSources()` to convert into the flat
// `MediaSource[]` the player accepts.
// ---------------------------------------------------------------------------

export interface RawManifest {
  url: string;
  mimeType?: string;
}

export interface RawMedia {
  mediaId?: string;
  poster?: string;
  /** HLS manifest (.m3u8). Strongly recommended for iOS compatibility. */
  m3u8?: RawManifest;
  /** DASH manifest (.mpd). */
  mpd?: RawManifest;
}

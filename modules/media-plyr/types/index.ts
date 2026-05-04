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
  /**
   * Timed lyrics for audio tracks. Rendered as a karaoke-style scrolling
   * panel (active line highlighted + scrolled into view) by the
   * `<AudioPlayer>` when present. Independent from `subtitles` to keep the
   * caption rendering pipeline decoupled from lyric rendering.
   */
  lyrics?: LyricsTrack;
  drmConfig?: DrmConfig;
  adsConfig?: AdsConfig;
}

export interface SubtitleTrack {
  src: string;
  language: string;
  label: string;
  /** WebVTT MIME type override. Defaults to `text/vtt`. */
  mimeType?: string;
  /** Selected and made visible by default. Only one track should set this. */
  default?: boolean;
}

export interface LyricsTrack {
  /** URL to a WebVTT (.vtt) file containing time-coded lyric lines. */
  src: string;
  language?: string;
  label?: string;
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

/**
 * A descriptor for a text track that can be selected for display. Returned
 * by `MediaPlyrInstance.getTextTracks()` and emitted alongside the
 * `'texttrackchange'` event.
 *
 * Mirrors the relevant subset of Shaka's `extern.TextTrack` shape, plus the
 * application-level `active`/`visible` flags so consumers don't have to
 * cross-reference player state.
 */
export interface TextTrackInfo {
  id: number;
  language: string;
  label: string | null;
  kind: string | null;
  active: boolean;
  forced: boolean;
}

export interface TextTrackChangeEvent {
  tracks: TextTrackInfo[];
  active: TextTrackInfo | null;
  visible: boolean;
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
  | 'metadata'
  | 'texttrackchange'
  | 'offlineprogress'
  | 'offlinestored'
  | 'offlineremoved';

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

/**
 * Timed metadata frame surfaced to consumers (typically ID3 tags embedded
 * in HLS/CMAF streams). Mirrors Shaka's `MetadataFrame` shape but trimmed
 * to the fields we need.
 */
export interface MediaMetadataFrame {
  /** Frame identifier — for ID3 this is the 4-char frame ID (e.g. `TIT2`). */
  key: string;
  description: string;
  data: string | number | ArrayBuffer | null;
  mimeType: string | null;
  pictureType: number | null;
}

export interface MediaMetadataEvent {
  startTime: number;
  endTime: number | null;
  /** Scheme URI / metadata source descriptor (e.g. `org.id3`, `com.apple.id3`). */
  metadataType: string;
  frames: MediaMetadataFrame[];
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

  /** Available subtitle/caption tracks. Empty until the manifest has loaded. */
  getTextTracks(): TextTrackInfo[];
  /**
   * Select a text track by id. Pass `null` to clear the selection. Selecting
   * a track does not implicitly toggle visibility — call `setTextVisible`.
   */
  selectTextTrack(id: number | null): void;
  /** Show or hide the currently selected text track. */
  setTextVisible(visible: boolean): void;
  isTextVisible(): boolean;

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

// ---------------------------------------------------------------------------
// Offline storage
// ---------------------------------------------------------------------------

/** Application-level metadata persisted alongside an offline asset. */
export interface OfflineAppMetadata {
  title?: string;
  artist?: string;
  artwork?: string;
  [key: string]: unknown;
}

export interface OfflineDownloadOptions {
  /** Mime type for the manifest URL (e.g. `application/dash+xml`). */
  mimeType?: string;
  /** Application metadata persisted alongside the asset. */
  appMetadata?: OfflineAppMetadata;
  /** Called with progress in [0, 1]. */
  onProgress?: (progress: number) => void;
}

export interface OfflineStoredAsset {
  /** `offline:` URI to be passed to the player to play back this asset. */
  offlineUri: string;
  /** Source manifest URL the asset was downloaded from. */
  originalManifestUri: string;
  duration: number;
  size: number;
  isIncomplete: boolean;
  appMetadata: OfflineAppMetadata | null;
}

export interface OfflineProgressEvent {
  offlineUri: string | null;
  progress: number;
}

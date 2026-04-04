export type MediaKind = 'video' | 'audio';

export type SourceContainer =
  | 'hls'
  | 'dash'
  | 'mp4'
  | 'webm'
  | 'mp3'
  | 'aac'
  | 'ogg';

export type MediaMimeType =
  | 'video/mp4'
  | 'video/webm'
  | 'audio/mp3'
  | 'audio/mpeg'
  | 'audio/mp4'
  | 'audio/aac'
  | 'audio/ogg'
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

export interface MediaSource {
  container: SourceContainer;
  mimeType: MediaMimeType;
  url: string;
  bitrate?: number;
  size?: string;
  resolution?: string;
}

export interface MediaPlyrConfig {
  kind: MediaKind;
  sources: MediaSource[];
  title: string;
  poster?: string;
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
  destroy(): void;

  getPlaybackState(): PlaybackState;

  on(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void;
  off(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void;

  readonly videoElement: HTMLVideoElement | HTMLAudioElement | null;
}

// ---------------------------------------------------------------------------
// Raw media types — the pre-normalized shape before conversion to
// `MediaSource[]`.  Use `mapRawMediaToSources()` to convert.
// ---------------------------------------------------------------------------

export interface RawHlsQuality {
  bitrate: number;
  size: string;
  resolution: string;
}

export interface RawHlsMedia {
  mimeType: string;
  url: string;
  qualities: RawHlsQuality[];
}

export interface RawProgressiveQuality {
  bitrate: number;
  size: string;
  resolution: string;
  url: string;
}

export interface RawProgressiveMedia {
  mimeType: string;
  qualities: RawProgressiveQuality[];
}

export interface RawMedia {
  mediaId?: string;
  poster?: string;
  m3u8: RawHlsMedia;
  mp4: RawProgressiveMedia;
  webm: RawProgressiveMedia;
}

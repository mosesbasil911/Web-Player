export type MediaType =
  | 'video/mp4'
  | 'video/webm'
  | 'audio/mp3'
  | 'audio/mpeg'
  | 'application/x-mpegURL'
  | 'application/dash+xml';

export type RepeatMode = 'none' | 'one' | 'all';

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export type AdBreakType = 'pre-roll' | 'mid-roll' | 'post-roll' | 'custom';

export interface MediaTrack {
  src: string;
  type: MediaType;
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

export interface PlaybackMemoryConfig {
  enabled: boolean;
  intervalMs?: number;
  storageKey?: string;
}

export interface CrossfadeConfig {
  enabled: boolean;
  durationMs?: number;
}

export interface MediaPlyrConfig {
  src: string;
  type: MediaType;
  title: string;
  poster?: string;
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
  playbackMemory?: PlaybackMemoryConfig;
  crossfade?: CrossfadeConfig;

  subtitles?: SubtitleTrack[];
}

export interface VideoPlayerProps {
  config: MediaPlyrConfig;
  className?: string;
  onReady?: (player: MediaPlyrInstance) => void;
  onError?: (error: MediaPlyrError) => void;
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

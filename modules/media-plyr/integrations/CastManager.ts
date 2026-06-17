import { EventEmitter } from '../core/EventEmitter.ts';
import type {
  CastConfig,
  CastConnectionState,
  CastStateEvent,
  MediaPlyrInstance,
} from '../types/index.ts';

/**
 * Minimal ambient type surface for the Google Cast Web Sender SDK
 * (`cast.framework.*`). We type only what we use — the full SDK is loaded
 * at runtime via a `<script>` tag, not an npm package.
 */
interface CastContextInstance {
  setOptions(options: {
    receiverApplicationId: string;
    autoJoinPolicy: string;
    language?: string;
  }): void;
  requestSession(): Promise<void>;
  endCurrentSession(stopCasting: boolean): void;
  getCurrentSession(): CastSessionInstance | null;
  getCastState(): string;
  addEventListener(type: string, handler: (event: CastStateEventData) => void): void;
  removeEventListener(type: string, handler: (event: CastStateEventData) => void): void;
}

interface CastStateEventData {
  castState: string;
}

interface CastSessionInstance {
  getSessionObj(): { receiver?: { friendlyName?: string } };
  getMediaSession(): RemoteMediaSession | null;
}

interface RemoteMediaSession {
  playerState: string;
  getEstimatedTime(): number;
  media?: { duration?: number };
}

interface RemotePlayerInstance {
  currentTime: number;
  duration: number;
  volumeLevel: number;
  isMuted: boolean;
  isPaused: boolean;
  isMediaLoaded: boolean;
  playerState: string;
  mediaInfo: {
    contentId: string;
    contentType: string;
    streamType: string;
    metadata?: unknown;
  } | null;
}

interface RemotePlayerControllerInstance {
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
  playOrPause(): void;
  stop(): void;
  seek(): void;
  muteOrUnmute(): void;
  setVolumeLevel(): void;
}

interface CastFramework {
  CastContext: { getInstance(): CastContextInstance };
  RemotePlayer: new () => RemotePlayerInstance;
  RemotePlayerController: new (player: RemotePlayerInstance) => RemotePlayerControllerInstance;
  CastState: Record<string, string>;
  RemotePlayerEventType: Record<string, string>;
  SessionState: Record<string, string>;
}

interface ChromeNamespace {
  cast: {
    AutoJoinPolicy: Record<string, string>;
    media: {
      MediaInfo: new (contentId: string, contentType: string) => {
        contentId: string;
        contentType: string;
        streamType: string;
        metadata: unknown;
      };
      GenericMediaMetadata: new () => {
        title: string;
        images: Array<{ url: string }>;
      };
      StreamType: Record<string, string>;
    };
  };
}

declare const cast: { framework: CastFramework } | undefined;
declare const chrome: ChromeNamespace | undefined;

const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_RECEIVER_APP_ID = 'CC1AD845';

function getCastFramework(): CastFramework | null {
  if (typeof cast !== 'undefined' && cast?.framework) return cast.framework;
  return null;
}

function getChromeNamespace(): ChromeNamespace | null {
  if (typeof chrome !== 'undefined' && chrome?.cast) return chrome as ChromeNamespace;
  return null;
}

/**
 * Google Cast (Chromecast) sender integration.
 *
 * Loads the Cast Web Sender SDK, initializes a CastContext, and proxies
 * playback commands between the local `MediaPlyrInstance` and the remote
 * Cast receiver. Follows the same sidecar-class lifecycle as
 * `MediaSessionManager` and `OfflineManager`.
 *
 * Usage:
 *   const castMgr = new CastManager(player, { receiverApplicationId: '...' });
 *   await castMgr.init();
 *   castMgr.on('caststate', (e) => console.log(e));
 *   // user clicks cast button →
 *   await castMgr.requestSession();
 *   // …later…
 *   castMgr.destroy();
 */
export class CastManager {
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'chrome' in window &&
      /Chrome/.test(navigator.userAgent) &&
      !/Edge/.test(navigator.userAgent)
    );
  }

  private player: MediaPlyrInstance;
  private config: CastConfig;
  private emitter = new EventEmitter();
  private destroyed = false;
  private initialized = false;

  private framework: CastFramework | null = null;
  private castContext: CastContextInstance | null = null;
  private remotePlayer: RemotePlayerInstance | null = null;
  private remoteController: RemotePlayerControllerInstance | null = null;
  private castStateHandler: ((event: CastStateEventData) => void) | null = null;
  private remoteEventHandler: (() => void) | null = null;

  private _connectionState: CastConnectionState = 'NO_DEVICES_AVAILABLE';
  private _deviceName: string | null = null;
  private _mediaTitle: string | null = null;
  private _mediaArtwork: string | null = null;

  constructor(player: MediaPlyrInstance, config: CastConfig = {}) {
    this.player = player;
    this.config = config;
  }

  get connected(): boolean {
    return this._connectionState === 'CONNECTED';
  }

  get connectionState(): CastConnectionState {
    return this._connectionState;
  }

  get deviceName(): string | null {
    return this._deviceName;
  }

  /**
   * Load the Cast SDK (if not already present) and initialize the
   * CastContext. Resolves once the SDK is ready to use.
   */
  async init(): Promise<void> {
    if (this.initialized || this.destroyed) return;

    if (!CastManager.isSupported()) return;

    await this.loadSdk();
    if (this.destroyed) return;

    this.framework = getCastFramework();
    if (!this.framework) return;

    this.castContext = this.framework.CastContext.getInstance();

    const chromeNs = getChromeNamespace();
    const autoJoinPolicy =
      this.config.autoJoinPolicy ??
      chromeNs?.cast.AutoJoinPolicy.ORIGIN_SCOPED ??
      'origin_scoped';

    this.castContext.setOptions({
      receiverApplicationId:
        this.config.receiverApplicationId || DEFAULT_RECEIVER_APP_ID,
      autoJoinPolicy,
      language: this.config.language,
    });

    this.remotePlayer = new this.framework.RemotePlayer();
    this.remoteController = new this.framework.RemotePlayerController(
      this.remotePlayer,
    );

    this.bindCastEvents();
    this.syncCastState();
    this.initialized = true;
  }

  /**
   * Open the Cast device picker and start a session. If a session is
   * already active this is a no-op.
   */
  async requestSession(): Promise<void> {
    if (!this.castContext || this.destroyed) return;
    if (this.connected) return;

    try {
      await this.castContext.requestSession();
    } catch {
      // User cancelled the picker or no devices found — not an error.
    }
  }

  /** End the current Cast session, stopping playback on the receiver. */
  endSession(): void {
    if (!this.castContext || this.destroyed) return;
    this.castContext.endCurrentSession(true);
  }

  /**
   * Load the currently-configured source on the remote receiver. Called
   * automatically when a session starts, but can also be invoked manually
   * after a source change.
   */
  loadMediaOnReceiver(): void {
    if (!this.connected || !this.castContext || !this.remotePlayer) return;

    const session = this.castContext.getCurrentSession();
    if (!session) return;

    const chromeNs = getChromeNamespace();
    if (!chromeNs) return;

    const element = this.player.videoElement;
    const sources = this.getActiveSources();
    if (sources.length === 0) return;

    const url = sources[0].url;
    const contentType = sources[0].mimeType ?? 'application/x-mpegURL';

    const mediaInfo = new chromeNs.cast.media.MediaInfo(url, contentType);
    mediaInfo.streamType = chromeNs.cast.media.StreamType.BUFFERED;

    const metadata = new chromeNs.cast.media.GenericMediaMetadata();
    metadata.title = this.getTitle();
    const poster = this.getPoster();
    if (poster) {
      metadata.images = [{ url: poster }];
    }
    mediaInfo.metadata = metadata;

    const request = new (this.getCastMediaRequestCtor())(mediaInfo);

    if (element) {
      request.currentTime = element.currentTime;
    }

    const sessionObj = session as unknown as {
      loadMedia(req: unknown): Promise<void>;
    };
    sessionObj.loadMedia(request).then(() => {
      if (element && !element.paused) {
        element.pause();
      }
    }).catch((err: unknown) => {
      console.error('[mediaPlyr] Cast loadMedia failed:', err);
    });
  }

  /** Proxy play/pause to the remote receiver when casting. */
  playOrPause(): void {
    this.remoteController?.playOrPause();
  }

  /** Proxy seek to the remote receiver. */
  seek(time: number): void {
    if (!this.remotePlayer || !this.remoteController) return;
    this.remotePlayer.currentTime = time;
    this.remoteController.seek();
  }

  /** Proxy volume to the remote receiver (0–1). */
  setVolume(volume: number): void {
    if (!this.remotePlayer || !this.remoteController) return;
    this.remotePlayer.volumeLevel = Math.max(0, Math.min(1, volume));
    this.remoteController.setVolumeLevel();
  }

  /** Proxy mute toggle to the remote receiver. */
  muteOrUnmute(): void {
    this.remoteController?.muteOrUnmute();
  }

  /** Stop playback on the remote receiver. */
  stop(): void {
    this.remoteController?.stop();
  }

  /**
   * Override title/artwork sent to the Cast receiver. Useful for audio
   * tracks where `document.title` and `video.poster` are not meaningful.
   */
  setMediaMetadata(opts?: { title?: string; artwork?: string }): void {
    if (opts?.title !== undefined) {
      this._mediaTitle = opts.title || null;
    }
    if (opts?.artwork !== undefined) {
      this._mediaArtwork = opts.artwork || null;
    }
  }

  on(
    event: 'caststate',
    callback: (data?: unknown) => void,
  ): void {
    this.emitter.on(event, callback);
  }

  off(
    event: 'caststate',
    callback: (data?: unknown) => void,
  ): void {
    this.emitter.off(event, callback);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.castContext && this.castStateHandler) {
      this.castContext.removeEventListener(
        'caststatechanged',
        this.castStateHandler,
      );
    }

    if (this.remoteController && this.remoteEventHandler && this.framework) {
      const eventTypes = this.framework.RemotePlayerEventType;
      for (const key of Object.keys(eventTypes)) {
        try {
          this.remoteController.removeEventListener(
            eventTypes[key],
            this.remoteEventHandler,
          );
        } catch {
          // Best-effort cleanup.
        }
      }
    }

    this.emitter.removeAllListeners();
    this.castContext = null;
    this.remotePlayer = null;
    this.remoteController = null;
    this.framework = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private loadSdk(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (getCastFramework()) {
        resolve();
        return;
      }

      // The Cast SDK announces readiness via `__onGCastApiAvailable`.
      const w = window as unknown as Record<string, unknown>;
      const existingCallback = w.__onGCastApiAvailable as
        | ((available: boolean) => void)
        | undefined;

      w.__onGCastApiAvailable = (
        available: boolean,
      ) => {
        existingCallback?.(available);
        resolve();
      };

      if (document.querySelector(`script[src*="cast_sender.js"]`)) {
        // Script tag already exists (e.g. added by host page) — just wait
        // for the callback.
        return;
      }

      const script = document.createElement('script');
      script.src = CAST_SDK_URL;
      script.async = true;
      script.onerror = () => {
        console.warn('[mediaPlyr] Failed to load Cast SDK');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private bindCastEvents(): void {
    if (!this.castContext || !this.framework) return;

    this.castStateHandler = () => this.syncCastState();
    this.castContext.addEventListener('caststatechanged', this.castStateHandler);

    this.remoteEventHandler = () => this.onRemotePlayerChange();
    if (this.remoteController) {
      const eventTypes = this.framework.RemotePlayerEventType;
      for (const key of Object.keys(eventTypes)) {
        try {
          this.remoteController.addEventListener(
            eventTypes[key],
            this.remoteEventHandler,
          );
        } catch {
          // Some event types may not be available — ignore.
        }
      }
    }
  }

  private syncCastState(): void {
    if (!this.castContext || !this.framework) return;

    const rawState = this.castContext.getCastState();
    const stateMap: Record<string, CastConnectionState> = {
      [this.framework.CastState.NO_DEVICES_AVAILABLE]: 'NO_DEVICES_AVAILABLE',
      [this.framework.CastState.NOT_CONNECTED]: 'NOT_CONNECTED',
      [this.framework.CastState.CONNECTING]: 'CONNECTING',
      [this.framework.CastState.CONNECTED]: 'CONNECTED',
    };

    const prev = this._connectionState;
    this._connectionState = stateMap[rawState] ?? 'NOT_CONNECTED';

    const session = this.castContext.getCurrentSession();
    this._deviceName =
      session?.getSessionObj()?.receiver?.friendlyName ?? null;

    const event: CastStateEvent = {
      connected: this.connected,
      connectionState: this._connectionState,
      deviceName: this._deviceName,
    };
    this.emitter.emit('caststate', event);

    // Auto-load media when transitioning to CONNECTED.
    if (this._connectionState === 'CONNECTED' && prev !== 'CONNECTED') {
      this.loadMediaOnReceiver();
    }
  }

  private onRemotePlayerChange(): void {
    // Re-emit caststate so the UI (and PlaybackState) can reflect
    // remote player updates (time, play/pause, etc.).
    this.syncCastState();
  }

  private getActiveSources(): Array<{ url: string; mimeType?: string }> {
    const el = this.player.videoElement;
    if (!el) return [];

    const src = el.currentSrc || el.src;
    if (!src) return [];

    let mimeType: string | undefined;
    if (/\.m3u8(\?|$)/i.test(src)) {
      mimeType = 'application/x-mpegURL';
    } else if (/\.mpd(\?|$)/i.test(src)) {
      mimeType = 'application/dash+xml';
    }

    return [{ url: src, mimeType }];
  }

  private getTitle(): string {
    return this._mediaTitle ?? document.title ?? 'Media';
  }

  private getPoster(): string | null {
    if (this._mediaArtwork) return this._mediaArtwork;

    const el = this.player.videoElement;
    if (el instanceof HTMLVideoElement && el.poster) return el.poster;
    return null;
  }

  private getCastMediaRequestCtor(): new (
    mediaInfo: unknown,
  ) => { currentTime: number } {
    const chromeNs = getChromeNamespace();
    if (!chromeNs) {
      // Fallback — should never happen if loadMediaOnReceiver checks first.
      return class {
        currentTime = 0;
        constructor(_info: unknown) { void _info; }
      } as unknown as new (mediaInfo: unknown) => { currentTime: number };
    }
    return (chromeNs.cast.media as unknown as {
      LoadRequest: new (mediaInfo: unknown) => { currentTime: number };
    }).LoadRequest;
  }
}

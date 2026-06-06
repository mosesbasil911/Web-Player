import { EventEmitter } from '../core/EventEmitter.ts';
import type {
  AdsConfig,
  AdBreak,
  AdBreakType,
  AdInfo,
  AdProgressEvent,
  AdErrorEvent,
  MediaPlyrInstance,
} from '../types/index.ts';

// ---------------------------------------------------------------------------
// Minimal ambient type surface for the Google IMA HTML5 SDK (`google.ima.*`).
// We type only what we use — the full SDK is loaded at runtime via a
// <script> tag.
// ---------------------------------------------------------------------------

interface ImaAd {
  getDuration(): number;
  isLinear(): boolean;
  isSkippable?(): boolean;
  getSkipTimeOffset(): number;
  getTitle(): string;
  getAdPodInfo(): {
    getAdPosition(): number;
    getTotalAds(): number;
    getPodIndex(): number;
    getTimeOffset(): number;
  };
}

interface ImaAdEvent {
  type: string;
  getAd(): ImaAd | null;
}

interface ImaAdErrorEvent {
  getError(): {
    getErrorCode(): number;
    getMessage(): string;
    getType?(): string;
  };
}

interface ImaAdsManagerInstance {
  init(width: number, height: number, viewMode: string): void;
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  resize(width: number, height: number, viewMode: string): void;
  setVolume(volume: number): void;
  getRemainingTime(): number;
  getCurrentAd?(): ImaAd | null;
  destroy(): void;
  addEventListener(
    type: string,
    handler: (event: ImaAdEvent | ImaAdErrorEvent) => void,
  ): void;
}

interface ImaAdsManagerLoadedEvent {
  getAdsManager(
    contentElement: HTMLMediaElement,
    renderingSettings?: unknown,
  ): ImaAdsManagerInstance;
}

interface ImaAdDisplayContainer {
  initialize(): void;
  destroy(): void;
}

interface ImaAdsLoader {
  addEventListener(
    type: string,
    handler: (event: ImaAdsManagerLoadedEvent | ImaAdErrorEvent) => void,
    capture?: boolean,
  ): void;
  requestAds(request: ImaAdsRequest): void;
  contentComplete(): void;
  destroy(): void;
}

interface ImaAdsRequest {
  adTagUrl: string;
  linearAdSlotWidth: number;
  linearAdSlotHeight: number;
  nonLinearAdSlotWidth: number;
  nonLinearAdSlotHeight: number;
  setAdWillAutoPlay?(autoPlay: boolean): void;
  setAdWillPlayMuted?(muted: boolean): void;
}

interface ImaNamespace {
  AdDisplayContainer: new (
    container: HTMLElement,
    media: HTMLMediaElement,
  ) => ImaAdDisplayContainer;
  AdsLoader: new (container: ImaAdDisplayContainer) => ImaAdsLoader;
  AdsRequest: new () => ImaAdsRequest;
  AdsRenderingSettings: new () => {
    restoreCustomPlaybackStateOnAdBreakComplete: boolean;
    enablePreloading: boolean;
    uiElements?: string[];
  };
  ViewMode: { NORMAL: string; FULLSCREEN: string };
  AdEvent: { Type: Record<string, string> };
  AdErrorEvent: { Type: Record<string, string> };
  AdsManagerLoadedEvent: { Type: Record<string, string> };
  settings: {
    setLocale(locale: string): void;
    setVpaidMode?(mode: number): void;
  };
  UiElements?: { AD_ATTRIBUTION: string; COUNTDOWN: string };
  ImaSdkSettings?: { VpaidMode?: { ENABLED: number; INSECURE: number } };
}

declare const google:
  | { ima?: ImaNamespace }
  | undefined;

const IMA_SDK_URL = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';

function getIma(): ImaNamespace | null {
  if (typeof google !== 'undefined' && google?.ima) return google.ima;
  return null;
}

/**
 * Google IMA (Interactive Media Ads) client-side integration.
 *
 * Ads are an *integration surface*, not infrastructure: the client supplies a
 * VAST/VMAP tag URL; IMA fetches and renders the creatives. This manager owns
 * the IMA SDK lifecycle and bridges its events into the player's event system.
 *
 * It is deliberately decoupled from Shaka — it talks only to the bound media
 * element (`player.videoElement`) and an ad container `<div>`. That keeps it
 * identical for `<video>` and `<audio>` players and means it never touches the
 * Shaka load path.
 *
 * Lifecycle:
 *   const ads = new AdsManager(player, config.ads, adContainerEl);
 *   await ads.init();          // loads the IMA SDK, builds loader + container
 *   ads.attachAutoPreroll();   // optional: intercept first play for a pre-roll
 *   ads.on('adstart', …);
 *   // …on teardown…
 *   ads.destroy();
 *
 * Pre-roll handling: IMA's `AdDisplayContainer.initialize()` must run inside a
 * user gesture (mobile autoplay policy). `attachAutoPreroll()` listens for the
 * content element's first `play`, pauses content, initializes the container in
 * that gesture, requests the pre-roll tag, and resumes content when the break
 * completes. VMAP mid/post breaks are then scheduled by IMA automatically.
 */
export class AdsManager {
  static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private player: MediaPlyrInstance;
  private config: AdsConfig;
  private container: HTMLElement;
  private emitter = new EventEmitter();
  private destroyed = false;
  private initialized = false;

  private ima: ImaNamespace | null = null;
  private displayContainer: ImaAdDisplayContainer | null = null;
  private adsLoader: ImaAdsLoader | null = null;
  private imaAdsManager: ImaAdsManagerInstance | null = null;

  private firstPlayHandler: (() => void) | null = null;
  private contentEndedHandler: (() => void) | null = null;
  private manualTimeUpdateHandler: (() => void) | null = null;
  private manualEndedHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private progressTimer: number | null = null;

  /** Manual breaks still pending (mid/post-roll), sorted by time. */
  private pendingBreaks: AdBreak[] = [];
  private postRollBreak: AdBreak | null = null;
  private currentBreakType: AdBreakType | null = null;
  private contentCompleteSent = false;
  /** Display container initialized (must happen once, inside a user gesture). */
  private displayInitialized = false;
  /** Tag URL currently being requested (single-tag vs per-break scheduling). */
  private adsRequested = false;
  /** Pre-roll not yet requested — cleared once `requestAds` runs for pre-roll. */
  private prerollPending = false;
  /** Play fired before the loader was ready (async SDK init race). */
  private prerollPlayPending = false;

  constructor(
    player: MediaPlyrInstance,
    config: AdsConfig,
    container: HTMLElement,
  ) {
    this.player = player;
    this.config = config;
    this.container = container;
  }

  /** Load the IMA SDK (if needed) and build the loader + display container. */
  async init(): Promise<void> {
    if (this.initialized || this.destroyed) return;
    if (!AdsManager.isSupported()) return;

    const media = this.player.videoElement;
    if (!media) return;

    // Register play intercept before any async work so a fast click (or audio
    // autoplay on track change) cannot slip past before the SDK finishes loading.
    this.attachAutoPreroll();

    await this.loadSdk();
    if (this.destroyed) return;

    this.ima = getIma();
    if (!this.ima) return;

    if (this.config.locale) {
      try {
        this.ima.settings.setLocale(this.config.locale);
      } catch {
        // Locale setting is best-effort.
      }
    }

    this.displayContainer = new this.ima.AdDisplayContainer(
      this.container,
      media,
    );
    this.adsLoader = new this.ima.AdsLoader(this.displayContainer);
    this.bindLoaderEvents();

    if (this.config.adBreaks && this.config.adBreaks.length > 0) {
      this.scheduleManualBreaks(this.config.adBreaks);
    } else {
      this.bindVmapContentEnded();
    }

    this.observeResize();
    this.initialized = true;

    // SDK + loader are ready — honour a play that arrived during init, or
    // rewind content that started without a pre-roll (common on audio autoplay).
    this.flushPendingPreroll();
    this.reconcileLateContentStart();
  }

  /**
   * Intercept the content element's first `play` to show a pre-roll. Called
   * synchronously at the start of `init()` — before the async SDK load.
   */
  attachAutoPreroll(): void {
    if (this.destroyed || this.config.disablePreloadOnPlay) return;
    const media = this.player.videoElement;
    if (!media || this.firstPlayHandler) return;

    this.prerollPending = true;

    this.firstPlayHandler = () => {
      if (!this.prerollPending) return;

      // Pause content immediately so the pre-roll plays first. When the
      // loader isn't ready yet (SDK still loading), defer the ad request.
      this.player.pause();
      this.prerollPlayPending = true;
      this.triggerPreroll();
    };

    media.addEventListener('play', this.firstPlayHandler);
  }

  /**
   * Request ads for the given tag. Exposed for callers that drive ad timing
   * themselves; the auto pre-roll and manual-break scheduler use it internally.
   */
  requestAds(tagUrl: string, breakType: AdBreakType | null = null): void {
    if (!this.ima || !this.adsLoader || this.destroyed) return;

    this.initializeDisplay();
    this.currentBreakType = breakType;

    const media = this.player.videoElement;
    const width = this.slotWidth();
    const height = this.slotHeight();

    const request = new this.ima.AdsRequest();
    request.adTagUrl = withCorrelator(tagUrl);
    request.linearAdSlotWidth = width;
    request.linearAdSlotHeight = height;
    request.nonLinearAdSlotWidth = width;
    request.nonLinearAdSlotHeight = Math.max(1, Math.round(height / 3));
    request.setAdWillAutoPlay?.(true);
    request.setAdWillPlayMuted?.(!!media?.muted);

    this.adsRequested = true;
    try {
      this.adsLoader.requestAds(request);
    } catch (err) {
      this.emitError(err);
    }
  }

  /** Resize the active ad to match the current container dimensions. */
  resize(): void {
    if (!this.imaAdsManager || !this.ima) return;
    const viewMode = document.fullscreenElement
      ? this.ima.ViewMode.FULLSCREEN
      : this.ima.ViewMode.NORMAL;
    try {
      this.imaAdsManager.resize(this.slotWidth(), this.slotHeight(), viewMode);
    } catch {
      // Resize before the manager is fully initialized — ignore.
    }
  }

  on(event: Parameters<EventEmitter['on']>[0], callback: Parameters<EventEmitter['on']>[1]): void {
    this.emitter.on(event, callback);
  }

  off(event: Parameters<EventEmitter['off']>[0], callback: Parameters<EventEmitter['off']>[1]): void {
    this.emitter.off(event, callback);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.firstPlayHandler && this.player.videoElement) {
      this.player.videoElement.removeEventListener(
        'play',
        this.firstPlayHandler,
      );
    }
    this.firstPlayHandler = null;

    if (this.contentEndedHandler && this.player.videoElement) {
      this.player.videoElement.removeEventListener(
        'ended',
        this.contentEndedHandler,
      );
    }
    this.contentEndedHandler = null;

    if (this.manualTimeUpdateHandler && this.player.videoElement) {
      this.player.videoElement.removeEventListener(
        'timeupdate',
        this.manualTimeUpdateHandler,
      );
    }
    this.manualTimeUpdateHandler = null;

    if (this.manualEndedHandler && this.player.videoElement) {
      this.player.videoElement.removeEventListener(
        'ended',
        this.manualEndedHandler,
      );
    }
    this.manualEndedHandler = null;

    this.stopProgressTimer();

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.imaAdsManager) {
      try {
        this.imaAdsManager.destroy();
      } catch {
        // Best-effort.
      }
      this.imaAdsManager = null;
    }

    if (this.adsLoader) {
      try {
        this.adsLoader.destroy();
      } catch {
        // Best-effort.
      }
      this.adsLoader = null;
    }

    if (this.displayContainer) {
      try {
        this.displayContainer.destroy();
      } catch {
        // Best-effort.
      }
      this.displayContainer = null;
    }

    this.emitter.removeAllListeners();
    this.ima = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private loadSdk(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (getIma()) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(
        `script[src*="ima3.js"]`,
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
        // Already loaded but not caught above — resolve on next tick.
        if (getIma()) resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = IMA_SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        console.warn('[mediaPlyr] Failed to load Google IMA SDK');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private initializeDisplay(): void {
    if (this.displayInitialized || !this.displayContainer) return;
    try {
      this.displayContainer.initialize();
      this.displayInitialized = true;
    } catch (err) {
      console.warn('[mediaPlyr] AdDisplayContainer init failed', err);
    }
  }

  private bindLoaderEvents(): void {
    if (!this.ima || !this.adsLoader) return;

    const onLoaded = (event: ImaAdsManagerLoadedEvent | ImaAdErrorEvent) => {
      this.onAdsManagerLoaded(event as ImaAdsManagerLoadedEvent);
    };
    const onError = (event: ImaAdsManagerLoadedEvent | ImaAdErrorEvent) => {
      this.onAdError(event as ImaAdErrorEvent);
    };

    this.adsLoader.addEventListener(
      this.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      onLoaded,
      false,
    );
    this.adsLoader.addEventListener(
      this.ima.AdErrorEvent.Type.AD_ERROR,
      onError,
      false,
    );
  }

  private onAdsManagerLoaded(event: ImaAdsManagerLoadedEvent): void {
    if (!this.ima || this.destroyed) return;

    const media = this.player.videoElement;
    if (!media) return;

    const renderingSettings = new this.ima.AdsRenderingSettings();
    // Hand content playback back to us cleanly after each break.
    renderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
    renderingSettings.enablePreloading = true;

    // Replace any prior manager (sequential per-break requests reuse loader).
    if (this.imaAdsManager) {
      try {
        this.imaAdsManager.destroy();
      } catch {
        // Best-effort.
      }
      this.imaAdsManager = null;
    }

    this.imaAdsManager = event.getAdsManager(media, renderingSettings);
    this.bindAdsManagerEvents();

    try {
      const viewMode = document.fullscreenElement
        ? this.ima.ViewMode.FULLSCREEN
        : this.ima.ViewMode.NORMAL;
      this.imaAdsManager.init(this.slotWidth(), this.slotHeight(), viewMode);
      this.imaAdsManager.start();
    } catch (err) {
      // If the ad fails to start, make sure content can resume.
      this.resumeContent();
      this.emitError(err);
    }
  }

  private bindAdsManagerEvents(): void {
    if (!this.ima || !this.imaAdsManager) return;
    const Type = this.ima.AdEvent.Type;

    const handle = (event: ImaAdEvent | ImaAdErrorEvent) => {
      const adEvent = event as ImaAdEvent;
      switch (adEvent.type) {
        case Type.CONTENT_PAUSE_REQUESTED:
          this.emitter.emit('adbreakstart', { adBreakType: this.currentBreakType });
          this.player.pause();
          break;
        case Type.CONTENT_RESUME_REQUESTED:
          this.emitter.emit('adbreakend', { adBreakType: this.currentBreakType });
          this.resumeContent();
          break;
        case Type.STARTED:
          this.onAdStarted(adEvent);
          break;
        case Type.COMPLETE:
          this.stopProgressTimer();
          this.emitter.emit('adend', { adBreakType: this.currentBreakType });
          break;
        case Type.SKIPPED:
          this.stopProgressTimer();
          this.emitter.emit('adskip', { adBreakType: this.currentBreakType });
          break;
        case Type.ALL_ADS_COMPLETED:
          this.stopProgressTimer();
          this.resumeContent();
          break;
        default:
          break;
      }
    };

    const adEventTypes = [
      Type.CONTENT_PAUSE_REQUESTED,
      Type.CONTENT_RESUME_REQUESTED,
      Type.STARTED,
      Type.COMPLETE,
      Type.SKIPPED,
      Type.ALL_ADS_COMPLETED,
    ];
    for (const type of adEventTypes) {
      if (type) this.imaAdsManager.addEventListener(type, handle);
    }

    this.imaAdsManager.addEventListener(
      this.ima.AdErrorEvent.Type.AD_ERROR,
      (event) => this.onAdError(event as ImaAdErrorEvent),
    );
  }

  private onAdStarted(event: ImaAdEvent): void {
    const ad = event.getAd();
    const info = this.toAdInfo(ad);
    this.emitter.emit('adstart', info);
    this.startProgressTimer();
  }

  private toAdInfo(ad: ImaAd | null): AdInfo {
    if (!ad) {
      return {
        linear: true,
        duration: -1,
        skippable: false,
        podPosition: 1,
        podCount: 1,
        adBreakType: this.currentBreakType,
        title: null,
      };
    }
    let podPosition = 1;
    let podCount = 1;
    try {
      const pod = ad.getAdPodInfo();
      podPosition = pod.getAdPosition();
      podCount = pod.getTotalAds();
    } catch {
      // Pod info not always available.
    }
    const skipOffset = safeNumber(() => ad.getSkipTimeOffset(), -1);
    return {
      linear: safeBool(() => ad.isLinear(), true),
      duration: safeNumber(() => ad.getDuration(), -1),
      skippable: ad.isSkippable ? safeBool(() => ad.isSkippable!(), skipOffset >= 0) : skipOffset >= 0,
      podPosition,
      podCount,
      adBreakType: this.currentBreakType,
      title: safeString(() => ad.getTitle()),
    };
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    if (!this.imaAdsManager) return;

    const tick = () => {
      const mgr = this.imaAdsManager;
      const currentAd = mgr?.getCurrentAd?.() ?? null;
      const remaining = mgr ? safeNumber(() => mgr.getRemainingTime(), -1) : -1;
      const duration = currentAd ? safeNumber(() => currentAd.getDuration(), -1) : -1;
      const skipOffset = currentAd
        ? safeNumber(() => currentAd.getSkipTimeOffset(), -1)
        : -1;
      const elapsed = duration >= 0 && remaining >= 0 ? duration - remaining : -1;
      const skipTimeRemaining =
        skipOffset >= 0 && elapsed >= 0
          ? Math.max(0, skipOffset - elapsed)
          : -1;

      const payload: AdProgressEvent = {
        currentTime: elapsed,
        duration,
        skipTimeRemaining,
      };
      this.emitter.emit('adprogress', payload);
    };

    tick();
    this.progressTimer = window.setInterval(tick, 250);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private resumeContent(): void {
    if (this.destroyed) return;
    // Post-roll: nothing left to resume.
    if (this.currentBreakType === 'post-roll') return;
    void this.player.play();
  }

  /** Start (or defer) the pre-roll ad request. No-op once pre-roll is delivered. */
  private triggerPreroll(): void {
    if (this.destroyed || !this.prerollPending) return;
    if (!this.ima || !this.adsLoader) return;

    const hasManualPreroll = (this.config.adBreaks ?? []).some(
      (b) => b.type === 'pre-roll',
    );

    this.detachFirstPlayHandler();
    this.prerollPending = false;
    this.prerollPlayPending = false;
    this.initializeDisplay();

    if (hasManualPreroll) {
      const preroll = (this.config.adBreaks ?? []).find(
        (b) => b.type === 'pre-roll',
      );
      if (preroll) this.requestAds(preroll.tagUrl, 'pre-roll');
      return;
    }

    this.requestAds(this.config.tagUrl, 'pre-roll');
  }

  /** Honour a play event that arrived while the SDK was still loading. */
  private flushPendingPreroll(): void {
    if (this.prerollPlayPending) {
      this.triggerPreroll();
    }
  }

  /**
   * Content started playing before the ad loader was ready (typical when
   * AudioPlayer auto-plays after a queue skip). Rewind and show the pre-roll.
   */
  private reconcileLateContentStart(): void {
    if (this.destroyed || !this.prerollPending) return;
    const media = this.player.videoElement;
    if (!media || media.ended) return;

    const startedWithoutPreroll =
      !media.paused && media.currentTime > 0 && media.currentTime < 3;
    if (!startedWithoutPreroll) return;

    this.player.pause();
    media.currentTime = 0;
    this.prerollPlayPending = true;
    this.triggerPreroll();
  }

  private detachFirstPlayHandler(): void {
    if (this.firstPlayHandler && this.player.videoElement) {
      this.player.videoElement.removeEventListener(
        'play',
        this.firstPlayHandler,
      );
    }
    this.firstPlayHandler = null;
  }

  /**
   * VMAP post-roll: notify IMA when main content finishes so scheduled
   * post-roll breaks can play. Only used for the tagUrl / VMAP path — manual
   * `adBreaks` post-roll is handled in `scheduleManualBreaks`.
   */
  private bindVmapContentEnded(): void {
    const media = this.player.videoElement;
    if (!media || this.contentEndedHandler) return;

    this.contentEndedHandler = () => {
      if (this.destroyed || this.contentCompleteSent) return;
      if (!this.adsLoader || !this.adsRequested) return;

      this.contentCompleteSent = true;
      this.currentBreakType = 'post-roll';
      try {
        this.adsLoader.contentComplete();
      } catch (err) {
        console.warn('[mediaPlyr] adsLoader.contentComplete failed', err);
      }
    };

    media.addEventListener('ended', this.contentEndedHandler);
  }

  private scheduleManualBreaks(breaks: AdBreak[]): void {
    const media = this.player.videoElement;
    if (!media) return;

    this.postRollBreak = breaks.find((b) => b.type === 'post-roll') ?? null;
    this.pendingBreaks = breaks
      .filter((b) => b.type === 'mid-roll' || b.type === 'custom')
      .filter((b) => typeof b.offsetSeconds === 'number')
      .sort((a, b) => (a.offsetSeconds ?? 0) - (b.offsetSeconds ?? 0));

    this.manualTimeUpdateHandler = () => {
      if (this.destroyed || this.pendingBreaks.length === 0) return;
      const t = media.currentTime;
      const next = this.pendingBreaks[0];
      if (next && (next.offsetSeconds ?? 0) <= t) {
        this.pendingBreaks.shift();
        this.requestAds(next.tagUrl, next.type);
      }
    };

    this.manualEndedHandler = () => {
      if (this.destroyed || !this.postRollBreak) return;
      if (!this.contentCompleteSent) {
        this.contentCompleteSent = true;
        try {
          this.adsLoader?.contentComplete();
        } catch (err) {
          console.warn('[mediaPlyr] adsLoader.contentComplete failed', err);
        }
      }
      const post = this.postRollBreak;
      this.postRollBreak = null;
      this.requestAds(post.tagUrl, 'post-roll');
    };

    media.addEventListener('timeupdate', this.manualTimeUpdateHandler);
    media.addEventListener('ended', this.manualEndedHandler);
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private slotWidth(): number {
    const w = this.container.clientWidth;
    if (w > 0) return w;
    const parent = this.container.parentElement;
    return Math.max(1, parent?.clientWidth ?? 640);
  }

  private slotHeight(): number {
    const h = this.container.clientHeight;
    if (h > 0) return h;
    const parent = this.container.parentElement;
    // IMA rejects zero-height slots; audio panels may collapse before layout.
    return Math.max(360, parent?.clientHeight ?? 360);
  }

  private onAdError(event: ImaAdErrorEvent): void {
    let code = -1;
    let message = 'Ad playback error';
    try {
      const err = event.getError();
      code = err.getErrorCode();
      message = err.getMessage();
    } catch {
      // Use defaults.
    }
    this.stopProgressTimer();
    const payload: AdErrorEvent = { code, message, recoverable: true };
    console.warn('[mediaPlyr] IMA ad error:', code, message);
    this.emitter.emit('aderror', payload);
    // Always let content continue on an ad error.
    this.resumeContent();
  }

  private emitError(err: unknown): void {
    const payload: AdErrorEvent = {
      code: -1,
      message: err instanceof Error ? err.message : 'Ad request failed',
      recoverable: true,
    };
    this.emitter.emit('aderror', payload);
  }

  /** Whether any ad request has been issued (single-tag or per-break). */
  hasRequestedAds(): boolean {
    return this.adsRequested;
  }
}

function safeNumber(fn: () => number, fallback: number): number {
  try {
    const v = fn();
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function safeBool(fn: () => boolean, fallback: boolean): boolean {
  try {
    return !!fn();
  } catch {
    return fallback;
  }
}

function safeString(fn: () => string): string | null {
  try {
    const v = fn();
    return v ? v : null;
  } catch {
    return null;
  }
}

/** Ensure every ad request carries a unique correlator (required by many ad servers). */
function withCorrelator(tagUrl: string): string {
  if (/[?&]correlator=\d/.test(tagUrl)) return tagUrl;
  if (tagUrl.endsWith('correlator=')) {
    return `${tagUrl}${Date.now()}`;
  }
  const sep = tagUrl.includes('?') ? '&' : '?';
  return `${tagUrl}${sep}correlator=${Date.now()}`;
}

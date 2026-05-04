import shaka from 'shaka-player';
import { EventEmitter } from './EventEmitter.ts';
import { orderSources } from '../utils/orderSources.ts';
import type {
  MediaPlyrConfig,
  MediaSource,
  MediaPlyrEventType,
  MediaPlyrEventCallback,
  MediaPlyrInstance,
  PlaybackState,
  PlaybackSpeed,
  MediaPlyrError,
  MediaMetadataEvent,
  MediaMetadataFrame,
  TextTrackInfo,
  TextTrackChangeEvent,
  SubtitleTrack,
} from '../types/index.ts';

shaka.polyfill.installAll();

export class MediaPlyr implements MediaPlyrInstance {
  private config: MediaPlyrConfig;
  private player: shaka.Player | null = null;
  private emitter = new EventEmitter();
  private element: HTMLVideoElement | HTMLAudioElement | null = null;
  private destroyed = false;
  private _waiting = false;
  /**
   * Caption / subtitle visibility state tracked here rather than via
   * Shaka's internal TextDisplayer because `isTextVisible` /
   * `setTextVisibility` are NOT public methods on `shaka.Player` in
   * Shaka 5.x (they live only on the displayer implementations). We own
   * the container element, so we toggle a `data-captions-off` attribute
   * on it and let CSS control the `.shaka-text-container` visibility.
   */
  private _textVisible = false;

  constructor(config: MediaPlyrConfig) {
    this.config = config;
  }

  async attach(element: HTMLVideoElement | HTMLAudioElement): Promise<void> {
    if (this.destroyed) return;

    this.element = element;

    this.bindMediaEvents();

    if (this.config.volume !== undefined) {
      element.volume = Math.max(0, Math.min(1, this.config.volume));
    }
    if (this.config.muted) {
      element.muted = true;
    }
    if (this.config.playbackRate) {
      element.playbackRate = this.config.playbackRate;
    }

    if (this.config.sources.length === 0) {
      this.handleError({
        code: 1002,
        message: 'No sources provided',
        severity: 'fatal',
      });
      return;
    }

    if (!this.isShakaSupported()) {
      this.handleError({
        code: 1000,
        message: 'This browser is not supported. Please use a modern version of Chrome, Edge, Firefox, or Safari.',
        severity: 'fatal',
      });
      return;
    }

    const manifest = this.pickManifest();
    if (!manifest) {
      this.handleError({
        code: 1003,
        message: 'No HLS or DASH manifest provided. Progressive sources (mp4, webm, mp3) are not supported.',
        severity: 'fatal',
      });
      return;
    }

    try {
      await this.loadWithShaka(element, manifest);
      if (this.destroyed) return;
      await this.applySubtitleTracks();
      if (this.destroyed) return;
      this.emitter.emit('loaded');

      if (this.config.autoplay) {
        await this.play();
      }
    } catch (err) {
      if (this.destroyed) return;
      this.handleShakaError(err);
    }
  }

  /**
   * Load a new manifest into the already-attached Shaka player without
   * destroying or recreating it. Shaka gracefully aborts the current load
   * and begins the new one. Call this for source/track changes.
   */
  async loadSource(config: MediaPlyrConfig): Promise<void> {
    if (this.destroyed || !this.player) return;

    this.config = config;
    this._waiting = false;
    this.emitter.emit('loading');

    const manifest = this.pickManifest();
    if (!manifest) {
      this.handleError({
        code: 1003,
        message: 'No HLS or DASH manifest provided.',
        severity: 'fatal',
      });
      return;
    }

    try {
      await this.player.load(manifest.url, config.startTime);
      if (this.destroyed) return;
      await this.applySubtitleTracks();
      if (this.destroyed) return;
      this.emitter.emit('loaded');

      if (config.autoplay) {
        await this.play();
      }
    } catch (err) {
      if (this.destroyed) return;
      const isInterrupted = err instanceof shaka.util.Error
        && (err.code === 7000 || err.code === 7003);
      if (isInterrupted) return;
      this.handleShakaError(err);
    }
  }

  async play(): Promise<void> {
    if (!this.element) return;
    try {
      await this.element.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.handleError({
          code: 1001,
          message: 'Autoplay blocked by browser. User interaction required.',
          severity: 'recoverable',
          detail: err,
        });
      }
    }
  }

  pause(): void {
    this.element?.pause();
  }

  stop(): void {
    if (!this.element) return;
    this.element.pause();
    this.element.currentTime = 0;
  }

  seek(time: number): void {
    if (!this.element) return;
    const clamped = Math.max(0, Math.min(time, this.element.duration || 0));
    this.element.currentTime = clamped;
  }

  setVolume(volume: number): void {
    if (!this.element) return;
    this.element.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean): void {
    if (!this.element) return;
    this.element.muted = muted;
    this.emitter.emit('mute', { muted });
  }

  setPlaybackRate(rate: PlaybackSpeed): void {
    if (!this.element) return;
    this.element.playbackRate = rate;
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.element) return;

    const container = this.element.parentElement;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  async togglePip(): Promise<void> {
    if (!this.element || !(this.element instanceof HTMLVideoElement)) return;

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await this.element.requestPictureInPicture();
    }
  }

  getPlaybackState(): PlaybackState {
    const el = this.element;
    if (!el) {
      return {
        playing: false,
        paused: true,
        ended: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
        volume: 1,
        muted: false,
        playbackRate: 1,
        fullscreen: false,
        pip: false,
        seeking: false,
        waiting: false,
      };
    }

    return {
      playing: !el.paused && !el.ended,
      paused: el.paused,
      ended: el.ended,
      currentTime: el.currentTime,
      duration: el.duration || 0,
      buffered: this.getBufferedEnd(),
      volume: el.volume,
      muted: el.muted,
      playbackRate: el.playbackRate,
      fullscreen: !!document.fullscreenElement,
      pip: document.pictureInPictureElement === el,
      seeking: el.seeking,
      waiting: this._waiting,
    };
  }

  getTextTracks(): TextTrackInfo[] {
    if (!this.player) return [];
    return this.player.getTextTracks().map(toTextTrackInfo);
  }

  selectTextTrack(id: number | null): void {
    if (!this.player) return;
    if (id === null) {
      this.player.selectTextTrack(null);
      this.emitTextTrackChange();
      return;
    }
    const track = this.player.getTextTracks().find((t) => t.id === id);
    if (!track) return;
    this.player.selectTextTrack(track);
    this.emitTextTrackChange();
  }

  setTextVisible(visible: boolean): void {
    this._textVisible = visible;
    // Toggle a data attribute on the container so CSS can show/hide
    // `.shaka-text-container` without touching Shaka internals.
    const container = this.element?.parentElement;
    if (container) {
      container.toggleAttribute('data-captions-off', !visible);
    }
    this.emitTextTrackChange();
  }

  isTextVisible(): boolean {
    return this._textVisible;
  }

  on(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    this.emitter.on(event, callback);
  }

  off(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    this.emitter.off(event, callback);
  }

  get videoElement(): HTMLVideoElement | HTMLAudioElement | null {
    return this.element;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.unbindMediaEvents();
    this.emitter.emit('destroy');
    this.emitter.removeAllListeners();

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    this.element = null;
  }

  updateConfig(config: Partial<MediaPlyrConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getShakaPlayer(): shaka.Player | null {
    return this.player;
  }

  // --- Private ---

  private configureDrm(): void {
    if (!this.player || !this.config.drm) return;

    this.player.configure({
      drm: {
        servers: this.config.drm.servers,
        advanced: this.config.drm.advanced as Record<string, shaka.extern.AdvancedDrmConfiguration>,
      },
    });
  }

  /**
   * Picks the best manifest to hand Shaka. Honours `preferredOrder` if
   * provided, otherwise defaults to HLS-first — Shaka handles HLS via MSE on
   * all modern browsers and falls back to native `video.src=` on iOS Safari,
   * so no device-specific branching is needed.
   */
  private pickManifest(): MediaSource | null {
    const sources = this.config.sources.filter(
      (s) => s.container === 'hls' || s.container === 'dash',
    );
    if (sources.length === 0) return null;

    const ordered = orderSources(sources, this.config.preferredOrder);
    return ordered[0] ?? null;
  }

  private async loadWithShaka(
    element: HTMLVideoElement | HTMLAudioElement,
    source: MediaSource,
  ): Promise<void> {
    if (!this.player) {
      this.player = new shaka.Player();
      await this.player.attach(element);
      // Hand Shaka the wrapping container so its UITextDisplayer renders
      // caption cues into a DOM overlay we can style with CSS, instead of
      // falling back to the browser's native (and very limited) text track
      // rendering. Audio elements have no meaningful container — we skip
      // and use cue-level subscriptions for lyrics instead.
      if (element instanceof HTMLVideoElement && element.parentElement) {
        this.player.setVideoContainer(element.parentElement);
        // setVideoContainer() only stores the container reference — it does
        // NOT automatically switch the displayer factory. Shaka's default is
        // NativeTextDisplayer which renders captions inside the <video>
        // element via native TextTrack mode, completely outside our DOM and
        // unreachable by CSS. Explicitly configuring UITextDisplayer forces
        // Shaka to mount a .shaka-text-container div inside our container,
        // which our data-captions-off CSS rule can then show/hide.
        this.configureUITextDisplayer();
      }
      this.configureDrm();
      this.configureAbr();
      this.configureStreaming();
      this.bindShakaEvents();
    }
    await this.player.load(source.url, this.config.startTime);
  }

  private isShakaSupported(): boolean {
    return shaka.Player.isBrowserSupported();
  }

  private configureUITextDisplayer(): void {
    if (!this.player) return;
    // Shaka 5.x changed the factory signature to `(player) => TextDisplayer`.
    // `UITextDisplayer` renders cues into a `.shaka-text-container` div
    // inside the video container we set via `setVideoContainer()`, which
    // lets our CSS control caption visibility.
    type UITextDisplayerCtor = new (player: shaka.Player) => object;
    const Ctor = (shaka as unknown as { text?: { UITextDisplayer?: UITextDisplayerCtor } })
      .text?.UITextDisplayer;
    if (!Ctor) return;

    this.player.configure({
      textDisplayFactory: (p: shaka.Player) => new Ctor(p),
    });
  }

  private configureAbr(): void {
    if (!this.player || !this.config.abr) return;

    const abrConfig: Record<string, unknown> = {};
    if (this.config.abr.enabled !== undefined) {
      abrConfig.enabled = this.config.abr.enabled;
    }
    if (this.config.abr.defaultBandwidthEstimate !== undefined) {
      abrConfig.defaultBandwidthEstimate = this.config.abr.defaultBandwidthEstimate;
    }
    if (this.config.abr.restrictions) {
      this.player.configure('restrictions', this.config.abr.restrictions);
    }

    this.player.configure('abr', abrConfig);
  }

  private configureStreaming(): void {
    if (!this.player) return;

    const sc = this.config.streaming;
    const streamingConfig: Record<string, unknown> = {
      // Evict buffer more than 30 s behind the playhead so backward seeks
      // don't collide with stale SourceBuffer data (prevents
      // CHUNK_DEMUXER_ERROR_APPEND_FAILED on DASH).
      bufferBehind: 30,
    };

    if (sc?.rebufferingGoal !== undefined) streamingConfig.rebufferingGoal = sc.rebufferingGoal;
    if (sc?.bufferingGoal !== undefined) streamingConfig.bufferingGoal = sc.bufferingGoal;
    if (sc?.bufferBehind !== undefined) streamingConfig.bufferBehind = sc.bufferBehind;
    if (sc?.lowLatencyMode !== undefined) streamingConfig.lowLatencyMode = sc.lowLatencyMode;
    if (sc?.retryParameters) streamingConfig.retryParameters = sc.retryParameters;

    this.player.configure('streaming', streamingConfig);
  }

  private mediaEventHandlers = new Map<string, EventListener>();

  private bindMediaEvents(): void {
    if (!this.element) return;

    const bind = (htmlEvent: string, plyrEvent: MediaPlyrEventType) => {
      const handler = () => this.emitter.emit(plyrEvent, this.getPlaybackState());
      this.mediaEventHandlers.set(htmlEvent, handler);
      this.element!.addEventListener(htmlEvent, handler);
    };

    bind('play', 'play');
    bind('pause', 'pause');
    bind('ended', 'ended');
    bind('timeupdate', 'timeupdate');
    bind('volumechange', 'volumechange');
    bind('ratechange', 'ratechange');
    bind('seeking', 'seeking');
    bind('seeked', 'seeked');

    const waitingHandler = () => {
      this._waiting = true;
      this.emitter.emit('buffering', this.getPlaybackState());
    };
    this.mediaEventHandlers.set('waiting', waitingHandler);
    this.element!.addEventListener('waiting', waitingHandler);

    const playingHandler = () => {
      this._waiting = false;
      this.emitter.emit('play', this.getPlaybackState());
    };
    this.mediaEventHandlers.set('playing', playingHandler);
    this.element!.addEventListener('playing', playingHandler);

    const errorHandler = () => {
      const mediaError = this.element?.error;
      if (mediaError) {
        this.handleError({
          code: mediaError.code,
          message: mediaError.message || `Media error code ${mediaError.code}`,
          severity: 'fatal',
        });
      }
    };
    this.mediaEventHandlers.set('error', errorHandler);
    this.element!.addEventListener('error', errorHandler);

    const fullscreenHandler = () => this.emitter.emit('fullscreenchange', {
      fullscreen: !!document.fullscreenElement,
    });
    this.mediaEventHandlers.set('fullscreenchange', fullscreenHandler);
    document.addEventListener('fullscreenchange', fullscreenHandler);

    if (this.element instanceof HTMLVideoElement) {
      const pipHandler = () => this.emitter.emit('pipchange', {
        pip: document.pictureInPictureElement === this.element,
      });
      this.mediaEventHandlers.set('enterpictureinpicture', pipHandler);
      this.mediaEventHandlers.set('leavepictureinpicture', pipHandler);
      this.element.addEventListener('enterpictureinpicture', pipHandler);
      this.element.addEventListener('leavepictureinpicture', pipHandler);
    }
  }

  private unbindMediaEvents(): void {
    if (!this.element) return;

    this.mediaEventHandlers.forEach((handler, event) => {
      if (event === 'fullscreenchange') {
        document.removeEventListener(event, handler);
      } else {
        this.element?.removeEventListener(event, handler);
      }
    });
    this.mediaEventHandlers.clear();
  }

  private _seekRecoveryAttempted = false;

  private bindShakaEvents(): void {
    if (!this.player) return;

    this.player.addEventListener('error', (event: Event) => {
      const detail = (event as unknown as { detail: shaka.util.Error }).detail;

      // Shaka 3015 = CHUNK_DEMUXER_ERROR_APPEND_FAILED. When this fires
      // mid-seek the SourceBuffer rejected a segment due to overlapping
      // buffer data. Reload at the current position once before giving up.
      if (
        detail.code === 3015 &&
        this.element &&
        !this._seekRecoveryAttempted
      ) {
        this._seekRecoveryAttempted = true;
        const pos = this.element.currentTime;
        const manifest = this.pickManifest();
        if (manifest && this.player) {
          console.warn(
            '[mediaPlyr] append failed during seek — reloading at',
            pos,
          );
          this.player.load(manifest.url, pos).then(() => {
            this._seekRecoveryAttempted = false;
          }).catch((err) => {
            this._seekRecoveryAttempted = false;
            this.handleShakaError(err);
          });
          return;
        }
      }
      this._seekRecoveryAttempted = false;

      this.handleError({
        code: detail.code,
        message: detail.message || `Shaka error code ${detail.code}`,
        severity: detail.severity === shaka.util.Error.Severity.CRITICAL
          ? 'fatal'
          : 'recoverable',
        detail,
      });
    });

    this.player.addEventListener('metadata', (event: Event) => {
      const payload = this.normalizeShakaMetadata(event);
      if (payload) this.emitter.emit('metadata', payload);
    });

    const onTextChange = () => this.emitTextTrackChange();
    this.player.addEventListener('trackschanged', onTextChange);
    this.player.addEventListener('textchanged', onTextChange);
  }

  private emitTextTrackChange(): void {
    if (!this.player) return;
    const tracks = this.player.getTextTracks().map(toTextTrackInfo);
    const active = tracks.find((t) => t.active) ?? null;
    const payload: TextTrackChangeEvent = {
      tracks,
      active,
      visible: this._textVisible,
    };
    this.emitter.emit('texttrackchange', payload);
  }

  /**
   * Adds any sidecar WebVTT tracks declared in `config.subtitles` to the
   * loaded manifest, then applies the initial visibility/selection. Must be
   * called after `player.load()` resolves — Shaka rejects
   * `addTextTrackAsync` calls before that point.
   */
  private async applySubtitleTracks(): Promise<void> {
    if (!this.player) return;
    const subtitles = this.config.subtitles;

    if (subtitles && subtitles.length > 0) {
      // Run sidecar additions in parallel; Shaka tolerates concurrent calls
      // and de-duplicates internally by uri+language+kind.
      await Promise.all(
        subtitles.map((sub) => this.addSidecarSubtitle(sub).catch((err) => {
          // Don't tear down playback for a single bad VTT — surface it as
          // a recoverable error and continue.
          this.handleError({
            code: 1100,
            message: `Failed to load subtitle "${sub.label}" (${sub.language})`,
            severity: 'recoverable',
            detail: err,
          });
        })),
      );
    }

    if (this.destroyed || !this.player) return;

    // Pick a default track + visibility from the config, otherwise leave
    // Shaka's manifest-driven defaults alone (some HLS/DASH manifests mark
    // a forced track as primary).
    const defaultSub = subtitles?.find((s) => s.default);
    if (defaultSub) {
      const tracks = this.player.getTextTracks();
      const match = tracks.find(
        (t) => t.language === defaultSub.language
          && (defaultSub.label ? t.label === defaultSub.label : true),
      );
      if (match) {
        this.player.selectTextTrack(match);
        this.setTextVisible(true);
      }
    }

    this.emitTextTrackChange();
  }

  private async addSidecarSubtitle(sub: SubtitleTrack): Promise<void> {
    if (!this.player) return;
    const mimeType = sub.mimeType ?? 'text/vtt';
    await this.player.addTextTrackAsync(
      sub.src,
      sub.language,
      'subtitles',
      mimeType,
      undefined,
      sub.label,
    );
  }

  /**
   * Shaka emits a `metadata` event whose `detail` is a `Map`-like structure
   * with `startTime`, `endTime`, `metadataType`, and `payload` (an
   * `ID3Metadata` or similar). We collapse that into a flat
   * `MediaMetadataEvent` for downstream consumers.
   */
  private normalizeShakaMetadata(event: Event): MediaMetadataEvent | null {
    const evt = event as unknown as {
      startTime?: number;
      endTime?: number | null;
      metadataType?: string;
      payload?: { frames?: unknown[] } | unknown;
    };

    const detail =
      typeof (event as unknown as { detail?: unknown }).detail === 'object'
        ? ((event as unknown as { detail: Record<string, unknown> }).detail)
        : null;

    const get = <T>(key: string, fallback: T): T => {
      if (detail && key in detail) return detail[key] as T;
      const direct = (evt as unknown as Record<string, unknown>)[key];
      return (direct ?? fallback) as T;
    };

    // Shaka stores fields in a `Map` on the event detail in some builds.
    let mapDetail: Map<string, unknown> | null = null;
    if (detail instanceof Map) {
      mapDetail = detail as Map<string, unknown>;
    }
    const fromMap = <T>(key: string, fallback: T): T =>
      mapDetail && mapDetail.has(key) ? (mapDetail.get(key) as T) : fallback;

    const startTime = mapDetail
      ? fromMap('startTime', 0)
      : get('startTime', 0);
    const endTime = mapDetail
      ? fromMap<number | null>('endTime', null)
      : get<number | null>('endTime', null);
    const metadataType = mapDetail
      ? fromMap('metadataType', 'unknown')
      : get('metadataType', 'unknown');
    const rawPayload = mapDetail
      ? fromMap<unknown>('payload', null)
      : get<unknown>('payload', null);

    const frames: MediaMetadataFrame[] = [];
    const collect = (frame: unknown) => {
      if (!frame || typeof frame !== 'object') return;
      const f = frame as Record<string, unknown>;
      frames.push({
        key: String(f.key ?? ''),
        description: String(f.description ?? ''),
        data: (f.data as MediaMetadataFrame['data']) ?? null,
        mimeType: (f.mimeType as string | null) ?? null,
        pictureType: (f.pictureType as number | null) ?? null,
      });
    };

    if (rawPayload && typeof rawPayload === 'object') {
      const payloadFrames = (rawPayload as { frames?: unknown[] }).frames;
      if (Array.isArray(payloadFrames)) {
        payloadFrames.forEach(collect);
      } else {
        collect(rawPayload);
      }
    }

    return {
      startTime: typeof startTime === 'number' ? startTime : 0,
      endTime: typeof endTime === 'number' ? endTime : null,
      metadataType: String(metadataType),
      frames,
    };
  }

  private handleShakaError(err: unknown): void {
    if (err instanceof shaka.util.Error) {
      this.handleError({
        code: err.code,
        message: err.message || `Shaka error code ${err.code}`,
        severity: err.severity === shaka.util.Error.Severity.CRITICAL
          ? 'fatal'
          : 'recoverable',
        detail: err,
      });
    } else {
      this.handleError({
        code: 9999,
        message: err instanceof Error ? err.message : 'Unknown error',
        severity: 'fatal',
        detail: err,
      });
    }
  }

  private handleError(error: MediaPlyrError): void {
    console.error(`[mediaPlyr] ${error.severity}: ${error.message}`, error.detail);
    this.emitter.emit('error', error);
  }

  private getBufferedEnd(): number {
    if (!this.element || !this.element.buffered.length) return 0;
    return this.element.buffered.end(this.element.buffered.length - 1);
  }
}

/**
 * Map Shaka's `extern.TextTrack` to our application-level descriptor.
 * Typed as `unknown` here because Shaka's compiled `.d.ts` bundles the type
 * inside `shaka.extern` which is non-trivial to reference statically — we
 * pluck the fields we care about defensively.
 */
function toTextTrackInfo(track: unknown): TextTrackInfo {
  const t = track as {
    id?: number;
    language?: string;
    label?: string | null;
    kind?: string | null;
    active?: boolean;
    forced?: boolean;
  };
  return {
    id: typeof t.id === 'number' ? t.id : -1,
    language: t.language ?? 'und',
    label: t.label ?? null,
    kind: t.kind ?? null,
    active: !!t.active,
    forced: !!t.forced,
  };
}

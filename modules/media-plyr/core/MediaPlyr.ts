import shaka from 'shaka-player';
import { EventEmitter } from './EventEmitter.ts';
import type {
  MediaPlyrConfig,
  MediaPlyrEventType,
  MediaPlyrEventCallback,
  MediaPlyrInstance,
  PlaybackState,
  PlaybackSpeed,
  MediaPlyrError,
} from '../types/index.ts';

export class MediaPlyr implements MediaPlyrInstance {
  private config: MediaPlyrConfig;
  private player: shaka.Player | null = null;
  private emitter = new EventEmitter();
  private element: HTMLVideoElement | HTMLAudioElement | null = null;
  private destroyed = false;

  constructor(config: MediaPlyrConfig) {
    this.config = config;
  }

  async attach(element: HTMLVideoElement | HTMLAudioElement): Promise<void> {
    if (this.destroyed) return;

    this.element = element;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      this.handleError({
        code: 1000,
        message: 'Browser not supported by Shaka Player',
        severity: 'fatal',
      });
      return;
    }

    this.player = new shaka.Player();
    await this.player.attach(element);

    this.configureDrm();
    this.configureAbr();
    this.bindMediaEvents();
    this.bindShakaEvents();

    if (this.config.volume !== undefined) {
      element.volume = Math.max(0, Math.min(1, this.config.volume));
    }
    if (this.config.muted) {
      element.muted = true;
    }
    if (this.config.playbackRate) {
      element.playbackRate = this.config.playbackRate;
    }

    try {
      await this.player.load(this.config.src, this.config.startTime);
      if (this.destroyed) return;
      this.emitter.emit('loaded');

      if (this.config.autoplay) {
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
      waiting: false,
    };
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
    bind('waiting', 'buffering');

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

  private bindShakaEvents(): void {
    if (!this.player) return;

    this.player.addEventListener('error', (event: Event) => {
      const detail = (event as unknown as { detail: shaka.util.Error }).detail;
      this.handleError({
        code: detail.code,
        message: detail.message || `Shaka error code ${detail.code}`,
        severity: detail.severity === shaka.util.Error.Severity.CRITICAL
          ? 'fatal'
          : 'recoverable',
        detail,
      });
    });
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

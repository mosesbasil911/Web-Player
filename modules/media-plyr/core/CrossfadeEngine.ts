import shaka from 'shaka-player';
import { orderSources } from '../utils/orderSources.ts';
import type { MediaPlyrConfig, MediaSource } from '../types/index.ts';

/**
 * Owns a hidden secondary `<audio>` element and its own Shaka Player. Used
 * to pre-buffer the next track in a queue so that switches feel instant,
 * and to perform a true crossfade by playing the next track concurrently
 * with the primary while ramping volumes.
 *
 * The engine is intentionally decoupled from React. `AudioPlayer` drives it
 * through a few imperative methods.
 */
export class CrossfadeEngine {
  private element: HTMLAudioElement;
  private player: shaka.Player | null = null;
  private currentSourceUrl: string | null = null;
  private fadeRaf: number | null = null;
  private destroyed = false;

  constructor() {
    this.element = document.createElement('audio');
    this.element.preload = 'auto';
    this.element.crossOrigin = 'anonymous';
    this.element.style.display = 'none';
    this.element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.element);
  }

  getElement(): HTMLAudioElement {
    return this.element;
  }

  /**
   * Pre-buffer the next track on the secondary element. If the same source
   * is already loaded, this is a no-op.
   */
  async prebuffer(config: MediaPlyrConfig | null): Promise<void> {
    if (this.destroyed) return;

    if (!config) {
      this.currentSourceUrl = null;
      try {
        await this.player?.unload();
      } catch {
        // no-op
      }
      return;
    }

    const manifest = this.pickManifest(config);
    if (!manifest) return;

    if (this.currentSourceUrl === manifest.url) return;

    if (!this.player) {
      this.player = new shaka.Player();
      try {
        await this.player.attach(this.element);
      } catch (err) {
        console.warn('[mediaPlyr] CrossfadeEngine: failed to attach Shaka', err);
        return;
      }
    }

    this.element.pause();
    this.element.currentTime = 0;
    this.element.volume = 0;
    this.element.muted = false;

    try {
      await this.player.load(manifest.url, 0);
      this.currentSourceUrl = manifest.url;
    } catch (err) {
      // Pre-buffer failure isn't fatal — the main player will still load
      // the track normally when the queue advances.
      const isInterrupted = err instanceof shaka.util.Error
        && (err.code === 7000 || err.code === 7003);
      if (!isInterrupted) {
        console.warn('[mediaPlyr] CrossfadeEngine: prebuffer failed', err);
      }
    }
  }

  hasPrebuffered(config: MediaPlyrConfig | null): boolean {
    if (!config) return false;
    const manifest = this.pickManifest(config);
    return !!manifest && this.currentSourceUrl === manifest.url;
  }

  /**
   * Begin playing the secondary element from `0`, ramping its volume up
   * to `targetVolume` over `durationMs` while simultaneously ramping the
   * primary element's volume down to 0. Resolves once the crossfade
   * completes, returning the secondary element's current time so the
   * caller can hand-off cleanly.
   */
  async startCrossfade(
    primary: HTMLAudioElement | HTMLVideoElement,
    durationMs: number,
    targetVolume: number,
  ): Promise<{ secondaryCurrentTime: number }> {
    if (this.destroyed) return { secondaryCurrentTime: 0 };

    this.cancelFade();

    this.element.currentTime = 0;
    this.element.volume = 0;
    this.element.muted = primary.muted;

    try {
      await this.element.play();
    } catch (err) {
      console.warn('[mediaPlyr] CrossfadeEngine: secondary playback blocked', err);
      return { secondaryCurrentTime: 0 };
    }

    const startTime = performance.now();
    const startPrimaryVolume = primary.volume;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));

    return new Promise((resolve) => {
      const tick = () => {
        if (this.destroyed) {
          resolve({ secondaryCurrentTime: this.element.currentTime });
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / Math.max(1, durationMs));
        primary.volume = Math.max(0, startPrimaryVolume * (1 - t));
        this.element.volume = clampedTarget * t;
        if (t >= 1) {
          this.fadeRaf = null;
          resolve({ secondaryCurrentTime: this.element.currentTime });
        } else {
          this.fadeRaf = requestAnimationFrame(tick);
        }
      };
      this.fadeRaf = requestAnimationFrame(tick);
    });
  }

  /**
   * After a successful crossfade, ramp the secondary down and pause it so
   * the primary (now loaded with the next track) can take over without
   * audio doubling.
   */
  async fadeOutSecondary(durationMs: number): Promise<void> {
    if (this.destroyed) return;
    this.cancelFade();

    const startTime = performance.now();
    const startVolume = this.element.volume;

    return new Promise((resolve) => {
      const tick = () => {
        if (this.destroyed) {
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / Math.max(1, durationMs));
        this.element.volume = Math.max(0, startVolume * (1 - t));
        if (t >= 1) {
          this.element.pause();
          this.element.volume = 0;
          this.fadeRaf = null;
          resolve();
        } else {
          this.fadeRaf = requestAnimationFrame(tick);
        }
      };
      this.fadeRaf = requestAnimationFrame(tick);
    });
  }

  cancelFade(): void {
    if (this.fadeRaf !== null) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = null;
    }
  }

  /** Stop and silence the secondary element without unloading the manifest. */
  silence(): void {
    this.cancelFade();
    this.element.pause();
    this.element.volume = 0;
  }

  getSecondaryCurrentTime(): number {
    return this.element.currentTime;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelFade();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
  }

  private pickManifest(config: MediaPlyrConfig): MediaSource | null {
    const sources = config.sources.filter(
      (s) => s.container === 'hls' || s.container === 'dash',
    );
    if (sources.length === 0) return null;
    return orderSources(sources, config.preferredOrder)[0] ?? null;
  }
}

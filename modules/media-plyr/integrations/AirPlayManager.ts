import { EventEmitter } from '../core/EventEmitter.ts';
import type { AirPlayStateEvent, MediaPlyrInstance } from '../types/index.ts';

/**
 * Ambient type extensions for WebKit's AirPlay APIs.
 * These are only present in Safari on macOS and iOS — the standard
 * `HTMLMediaElement` typings don't include them.
 */
interface WebKitMediaElement extends HTMLMediaElement {
  webkitShowPlaybackTargetPicker(): void;
  webkitCurrentPlaybackTargetIsWireless: boolean;
}

interface WebKitPlaybackTargetAvailabilityEvent extends Event {
  availability: 'available' | 'not-available';
}

/**
 * Apple AirPlay sender integration.
 *
 * Unlike Chromecast, AirPlay streams the local `<video>` or `<audio>` element
 * directly to the AirPlay target — the browser handles all media routing and
 * playback commands. There is no separate SDK to load, no remote media
 * session to manage, and no playback commands to proxy.
 *
 * The manager's job is to:
 *  1. Listen for device availability (`webkitplaybacktargetavailabilitychanged`)
 *     so the button can appear only when AirPlay targets are nearby.
 *  2. Listen for the active-state toggle
 *     (`webkitcurrentplaybacktargetiswirelesschanged`) so the button can
 *     reflect that streaming is in progress.
 *  3. Expose `showPicker()` to trigger the native OS device picker.
 *
 * Usage:
 *   const airPlayMgr = new AirPlayManager(player);
 *   airPlayMgr.on('airplaystate', (e) => console.log(e));
 *   airPlayMgr.init();   // call after the video element is attached
 *   // user clicks button →
 *   airPlayMgr.showPicker();
 *   // …later…
 *   airPlayMgr.destroy();
 */
export class AirPlayManager {
  /**
   * Returns true in Safari on macOS / iOS where the WebKit AirPlay API is
   * available. Always false in Chrome, Firefox, and Edge.
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'WebKitPlaybackTargetAvailabilityEvent' in window
    );
  }

  private player: MediaPlyrInstance;
  private emitter = new EventEmitter();
  private destroyed = false;
  private initialized = false;

  private _available = false;
  private _active = false;

  private availabilityHandler: ((e: Event) => void) | null = null;
  private wirelessHandler: ((e: Event) => void) | null = null;

  constructor(player: MediaPlyrInstance) {
    this.player = player;
  }

  get available(): boolean {
    return this._available;
  }

  get active(): boolean {
    return this._active;
  }

  /**
   * Attach AirPlay event listeners to the underlying media element.
   * Must be called after the player has been attached to a DOM element.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (this.initialized || this.destroyed) return;
    if (!AirPlayManager.isSupported()) return;

    const el = this.player.videoElement as WebKitMediaElement | null;
    if (!el) return;

    this.availabilityHandler = (e: Event) => {
      const event = e as WebKitPlaybackTargetAvailabilityEvent;
      this._available = event.availability === 'available';
      this.emitState();
    };

    this.wirelessHandler = () => {
      this._active = el.webkitCurrentPlaybackTargetIsWireless;
      this.emitState();
    };

    el.addEventListener(
      'webkitplaybacktargetavailabilitychanged',
      this.availabilityHandler,
    );
    el.addEventListener(
      'webkitcurrentplaybacktargetiswirelesschanged',
      this.wirelessHandler,
    );

    this.initialized = true;
  }

  /**
   * Open the native OS AirPlay device picker. The browser manages the
   * selection entirely — no further action from this manager is needed.
   *
   * Note: there is no programmatic way to end an AirPlay session from JS.
   * Calling this while active will show the picker with a "Stop AirPlay"
   * option that the user can select.
   */
  showPicker(): void {
    if (this.destroyed) return;

    const el = this.player.videoElement as WebKitMediaElement | null;
    if (!el) return;

    el.webkitShowPlaybackTargetPicker();
  }

  on(event: 'airplaystate', callback: (data?: unknown) => void): void {
    this.emitter.on(event, callback);
  }

  off(event: 'airplaystate', callback: (data?: unknown) => void): void {
    this.emitter.off(event, callback);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const el = this.player.videoElement;
    if (el) {
      if (this.availabilityHandler) {
        el.removeEventListener(
          'webkitplaybacktargetavailabilitychanged',
          this.availabilityHandler,
        );
      }
      if (this.wirelessHandler) {
        el.removeEventListener(
          'webkitcurrentplaybacktargetiswirelesschanged',
          this.wirelessHandler,
        );
      }
    }

    this.availabilityHandler = null;
    this.wirelessHandler = null;
    this.emitter.removeAllListeners();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private emitState(): void {
    const event: AirPlayStateEvent = {
      available: this._available,
      active: this._active,
    };
    this.emitter.emit('airplaystate', event);
  }
}

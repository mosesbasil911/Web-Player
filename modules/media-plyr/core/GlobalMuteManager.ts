/**
 * Singleton mute coordinator shared across every `MediaPlyr` instance on the
 * page. The browser persists per-element mute state on each `<video>` /
 * `<audio>`, which means one player can drift out of sync with another. The
 * `GlobalMuteManager` keeps a single source of truth and broadcasts changes
 * to any subscribed listener (typically the React context provider).
 *
 * The manager is intentionally framework-agnostic — it has no React
 * dependency. The companion `GlobalMuteContext` and `useGlobalMute` hook
 * adapt it for React consumers.
 */
export type GlobalMuteListener = (muted: boolean) => void;

export class GlobalMuteManager {
  private muted: boolean;
  private listeners = new Set<GlobalMuteListener>();

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.broadcast();
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  subscribe(listener: GlobalMuteListener): () => void {
    this.listeners.add(listener);
    listener(this.muted);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.muted);
      } catch (err) {
        console.error('[mediaPlyr] GlobalMuteManager listener error:', err);
      }
    });
  }
}

let defaultInstance: GlobalMuteManager | null = null;

/**
 * Returns the process-wide default `GlobalMuteManager`. Apps that prefer
 * scoped mute state can construct their own instance and pass it through
 * `<GlobalMuteProvider>` instead.
 */
export function getDefaultGlobalMuteManager(): GlobalMuteManager {
  if (!defaultInstance) {
    defaultInstance = new GlobalMuteManager();
  }
  return defaultInstance;
}

import type { PlaybackMemoryConfig } from "../types/index.ts";

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_STORAGE_KEY = "media-plyr:resume";

interface StoredPosition {
  time: number;
  updatedAt: number;
}

export class PlaybackMemory {
  private config: Required<PlaybackMemoryConfig>;
  private element: HTMLMediaElement | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private mediaId: string = "";

  constructor(config: PlaybackMemoryConfig) {
    this.config = {
      enabled: config.enabled,
      intervalMs: config.intervalMs ?? DEFAULT_INTERVAL_MS,
      storageKey: config.storageKey ?? DEFAULT_STORAGE_KEY,
    };
  }

  attach(element: HTMLMediaElement, mediaId: string): void {
    this.detach();
    if (!this.config.enabled) return;

    this.element = element;
    this.mediaId = mediaId;

    element.addEventListener("ended", this.handleEnded);

    this.intervalId = setInterval(() => this.save(), this.config.intervalMs);
  }

  detach(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.element?.removeEventListener("ended", this.handleEnded);
    this.element = null;
  }

  getSavedPosition(mediaId: string): number | null {
    try {
      const raw = localStorage.getItem(this.storageKeyFor(mediaId));
      if (!raw) return null;

      const stored: StoredPosition = JSON.parse(raw);
      if (typeof stored.time !== "number" || stored.time <= 0) return null;

      return stored.time;
    } catch {
      return null;
    }
  }

  clearPosition(mediaId: string): void {
    try {
      localStorage.removeItem(this.storageKeyFor(mediaId));
    } catch {
      // Storage not available
    }
  }

  private save = (): void => {
    const el = this.element;
    if (!el || !this.mediaId) return;
    if (el.paused || el.ended || !isFinite(el.currentTime)) return;
    if (el.currentTime < 1) return;

    try {
      const data: StoredPosition = {
        time: el.currentTime,
        updatedAt: Date.now(),
      };
      localStorage.setItem(
        this.storageKeyFor(this.mediaId),
        JSON.stringify(data),
      );
    } catch {
      // Storage full or unavailable
    }
  };

  private handleEnded = (): void => {
    this.clearPosition(this.mediaId);
  };

  private storageKeyFor(mediaId: string): string {
    return `${this.config.storageKey}:${mediaId}`;
  }
}

import type { MediaPlyrEventType, MediaPlyrEventCallback } from '../types/index.ts';

export class EventEmitter {
  private listeners = new Map<MediaPlyrEventType, Set<MediaPlyrEventCallback>>();

  on(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: MediaPlyrEventType, data?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[mediaPlyr] Error in "${event}" handler:`, err);
      }
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

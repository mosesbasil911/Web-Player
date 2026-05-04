import shaka from 'shaka-player';
import { EventEmitter } from '../core/EventEmitter.ts';
import type { MediaPlyr } from '../core/MediaPlyr.ts';
import type {
  OfflineAppMetadata,
  OfflineDownloadOptions,
  OfflineProgressEvent,
  OfflineStoredAsset,
} from '../types/index.ts';

/**
 * Wraps Shaka's `offline.Storage` so callers don't have to deal with its
 * `IAbortableOperation` shape, progress callbacks bound at construction
 * time, or the `appMetadata` round-tripping. One instance per logical
 * "offline session" — typically one per app.
 *
 * Usage:
 *   const offline = new OfflineManager();
 *   await offline.init();                // optional, called lazily otherwise
 *   const asset = await offline.download(manifestUrl, {
 *     mimeType: 'application/dash+xml',
 *     appMetadata: { title: 'Sintel' },
 *     onProgress: (p) => console.log(p),
 *   });
 *   // …later…
 *   await offline.remove(asset.offlineUri);
 *
 * Plays back via `MediaPlyr` by setting `sources: [{ container: 'dash', url: asset.offlineUri }]`.
 */

interface ShakaStoredContent {
  offlineUri: string | null;
  originalManifestUri: string;
  duration: number;
  size: number;
  isIncomplete: boolean;
  appMetadata: OfflineAppMetadata | null;
}

interface ShakaAbortableOperation<T> {
  promise: Promise<T>;
  abort: () => Promise<unknown>;
}

interface ShakaStorageInstance {
  configure(config: string | object, value?: unknown): boolean;
  destroy(): Promise<unknown>;
  list(): Promise<ShakaStoredContent[]>;
  remove(contentUri: string): Promise<unknown>;
  store(
    uri: string,
    appMetadata?: object,
    mimeType?: string | null,
  ): ShakaAbortableOperation<ShakaStoredContent>;
}

interface ShakaOfflineNamespace {
  Storage: {
    new (player?: unknown): ShakaStorageInstance;
    support(): boolean;
  };
}

function getOfflineNamespace(): ShakaOfflineNamespace {
  return (shaka as unknown as { offline: ShakaOfflineNamespace }).offline;
}

function normalizeStoredContent(
  raw: ShakaStoredContent,
): OfflineStoredAsset | null {
  if (!raw.offlineUri) return null;
  return {
    offlineUri: raw.offlineUri,
    originalManifestUri: raw.originalManifestUri,
    duration: raw.duration,
    size: raw.size,
    isIncomplete: raw.isIncomplete,
    appMetadata: raw.appMetadata,
  };
}

export class OfflineManager {
  /** Returns true if the platform supports offline storage of clear content. */
  static isSupported(): boolean {
    try {
      return !!getOfflineNamespace().Storage.support();
    } catch {
      return false;
    }
  }

  private storage: ShakaStorageInstance | null = null;
  private emitter = new EventEmitter();
  private destroyed = false;
  /**
   * The progress callback Shaka invokes during a `store()` is configured
   * once on the storage instance — but we want per-call callbacks. We
   * stash the active call's callback here and drive it from a single
   * configured callback on the storage.
   */
  private activeProgressCallback: ((progress: number) => void) | null = null;

  private player: MediaPlyr | null;

  constructor(player?: MediaPlyr | null) {
    this.player = player ?? null;
  }

  /**
   * Lazily creates the Shaka Storage instance. Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.storage || this.destroyed) return;

    const ns = getOfflineNamespace();
    const shakaPlayer = this.player?.getShakaPlayer?.() ?? null;
    this.storage = new ns.Storage(shakaPlayer);

    // Bind a single `progressCallback` once. It dispatches to whichever
    // download callback is currently active (set per `download()` call).
    this.storage.configure('offline.progressCallback', (
      content: ShakaStoredContent,
      progress: number,
    ) => {
      const event: OfflineProgressEvent = {
        offlineUri: content?.offlineUri ?? null,
        progress,
      };
      this.emitter.emit('offlineprogress', event);
      this.activeProgressCallback?.(progress);
    });
  }

  /**
   * Download a manifest for offline playback. Resolves with the stored
   * asset descriptor once the download completes. Rejects on abort or
   * fatal storage errors.
   */
  async download(
    manifestUri: string,
    options: OfflineDownloadOptions = {},
  ): Promise<OfflineStoredAsset> {
    await this.init();
    if (!this.storage || this.destroyed) {
      throw new Error('OfflineManager has been destroyed');
    }

    this.activeProgressCallback = options.onProgress ?? null;
    try {
      const op = this.storage.store(
        manifestUri,
        options.appMetadata,
        options.mimeType ?? null,
      );
      const stored = await op.promise;
      const normalized = normalizeStoredContent(stored);
      if (!normalized) {
        throw new Error('Storage returned an asset without an offlineUri');
      }
      this.emitter.emit('offlinestored', normalized);
      return normalized;
    } finally {
      this.activeProgressCallback = null;
    }
  }

  /** Removes a previously-stored asset by its `offline:` URI. */
  async remove(offlineUri: string): Promise<void> {
    await this.init();
    if (!this.storage || this.destroyed) return;
    await this.storage.remove(offlineUri);
    this.emitter.emit('offlineremoved', { offlineUri });
  }

  /** List all currently-stored offline assets. */
  async list(): Promise<OfflineStoredAsset[]> {
    await this.init();
    if (!this.storage || this.destroyed) return [];
    const list = await this.storage.list();
    return list
      .map(normalizeStoredContent)
      .filter((entry): entry is OfflineStoredAsset => entry !== null);
  }

  on(
    event: 'offlineprogress' | 'offlinestored' | 'offlineremoved',
    callback: (data?: unknown) => void,
  ): void {
    this.emitter.on(event, callback);
  }

  off(
    event: 'offlineprogress' | 'offlinestored' | 'offlineremoved',
    callback: (data?: unknown) => void,
  ): void {
    this.emitter.off(event, callback);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.activeProgressCallback = null;
    this.emitter.removeAllListeners();
    if (this.storage) {
      await this.storage.destroy().catch(() => {});
      this.storage = null;
    }
  }
}

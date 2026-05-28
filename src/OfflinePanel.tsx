import { useCallback, useEffect, useRef, useState } from 'react';
import { OfflineManager } from '@media-plyr/integrations/OfflineManager.ts';
import type {
  MediaPlyrConfig,
  MediaPlyrInstance,
  OfflineStoredAsset,
} from '@media-plyr/types/index.ts';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getManifestMimeType(config: MediaPlyrConfig): string {
  const source = config.sources[0];
  return source?.container === 'dash'
    ? 'application/dash+xml'
    : 'application/x-mpegURL';
}

export interface OfflinePanelProps {
  player: MediaPlyrInstance | null;
  config: MediaPlyrConfig | null;
  /**
   * When true, Play delegates to `onPlay` only — the parent (typically
   * AudioPlayer) handles loading so the queue stays in sync. Video uses the
   * default direct `player.loadSource()` path.
   */
  delegatePlayback?: boolean;
  /**
   * Called when the user presses Play on a stored asset. When
   * `delegatePlayback` is true this is the only action taken.
   */
  onPlay?: (asset: OfflineStoredAsset) => void;
}

export function OfflinePanel({
  player,
  config,
  delegatePlayback = false,
  onPlay,
}: OfflinePanelProps) {
  const [supported] = useState(() => OfflineManager.isSupported());
  const [assets, setAssets] = useState<OfflineStoredAsset[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const managerRef = useRef<OfflineManager | null>(null);

  useEffect(() => {
    if (!supported) return;

    // Pass the player so OfflineManager uses the same networking engine that
    // successfully streams this content. Without this, Shaka creates an
    // isolated network stack whose CORS/config may differ, causing segments
    // to silently fail to store — resulting in KEY_NOT_FOUND (9012) on playback.
    const mgr = new OfflineManager(player as never);
    managerRef.current = mgr;

    const refresh = () => mgr.list().then(setAssets);
    mgr.on('offlinestored', refresh);
    mgr.on('offlineremoved', refresh);
    refresh();

    return () => {
      mgr.destroy();
      managerRef.current = null;
    };
  }, [supported, player]);

  const handleDownload = useCallback(async () => {
    if (!config || !managerRef.current) return;
    const source = config.sources[0];
    if (!source) return;

    setDownloading(true);
    setProgress(0);
    setDownloadError(null);

    try {
      await managerRef.current.download(source.url, {
        mimeType: getManifestMimeType(config),
        appMetadata: {
          title: config.title,
          poster: config.poster,
          kind: config.kind,
        },
        onProgress: (p) => setProgress(Math.round(p * 100)),
      });
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Download failed. Check the console for details.',
      );
    } finally {
      setDownloading(false);
    }
  }, [config]);

  const handleDelete = useCallback(async (offlineUri: string) => {
    await managerRef.current?.remove(offlineUri);
  }, []);

  const handlePlayOffline = useCallback(
    (asset: OfflineStoredAsset) => {
      if (delegatePlayback) {
        onPlay?.(asset);
        return;
      }

      if (!player) return;

      setPlaybackError(null);

      // Listen for storage errors so we can surface them inside the panel.
      // MediaPlyr catches Shaka errors internally and emits 'error' rather than
      // rejecting the loadSource() promise, so we have to listen here.
      const onError = (data: unknown) => {
        const err = data as { code: number; message: string };
        if (err.code >= 9000) {
          setPlaybackError(
            'Could not load offline content (storage error). Try deleting and re-downloading.',
          );
        }
        player.off('error', onError);
        player.off('loaded', onLoaded);
      };
      const onLoaded = () => {
        player.off('error', onError);
        player.off('loaded', onLoaded);
      };
      player.on('error', onError);
      player.on('loaded', onLoaded);

      const title =
        (asset.appMetadata?.title as string | undefined) ?? 'Offline content';
      const isHls =
        asset.originalManifestUri.toLowerCase().includes('.m3u8') ||
        asset.originalManifestUri.toLowerCase().includes('mpegurl');
      const kind =
        (asset.appMetadata?.kind as 'video' | 'audio' | undefined) ??
        config?.kind ??
        'video';
      player.loadSource({
        kind,
        autoplay: true,
        sources: [{ container: isHls ? 'hls' : 'dash', url: asset.offlineUri }],
        title: `${title} (offline)`,
      });
    },
    [player, config?.kind, delegatePlayback, onPlay],
  );

  const currentUrl = config?.sources[0]?.url;
  const isAlreadyStored =
    !!currentUrl && assets.some((a) => a.originalManifestUri === currentUrl);

  return (
    <div className="offline-panel">
      <div className="offline-panel__header">
        <svg
          className="offline-panel__header-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <h3 className="offline-panel__title">Offline Playback</h3>
        {!supported && (
          <span className="offline-panel__unsupported-badge">
            Not available
          </span>
        )}
      </div>

      {!supported ? (
        <p className="offline-panel__note">
          Offline storage requires IndexedDB support. Try Chrome or Edge on a
          secure origin (HTTPS or localhost).
        </p>
      ) : (
        <>
          {/* Download row for the current source */}
          <div className="offline-panel__download-row">
            {config ? (
              <>
                <span
                  className="offline-panel__source-label"
                  title={config.title}
                >
                  {config.title}
                </span>
                {isAlreadyStored ? (
                  <span className="offline-panel__saved-badge">✓ Saved</span>
                ) : (
                  <button
                    type="button"
                    className="offline-panel__btn offline-panel__btn--download"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? `Downloading ${progress}%` : 'Download'}
                  </button>
                )}
              </>
            ) : (
              <span className="offline-panel__note">
                Select a source above to download it.
              </span>
            )}
          </div>

          {/* Progress bar */}
          {downloading && (
            <div
              className="offline-panel__progress-track"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Download progress: ${progress}%`}
            >
              <div
                className="offline-panel__progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {downloadError && (
            <p className="offline-panel__error" role="alert">
              {downloadError}
            </p>
          )}

          {playbackError && (
            <p className="offline-panel__error" role="alert">
              {playbackError}
            </p>
          )}

          {/* Stored assets */}
          {assets.length > 0 ? (
            <ul className="offline-panel__list">
              {assets.map((asset) => {
                const title =
                  (asset.appMetadata?.title as string | undefined) ??
                  'Saved content';
                return (
                  <li key={asset.offlineUri} className="offline-panel__item">
                    <div className="offline-panel__item-info">
                      <span className="offline-panel__item-title">{title}</span>
                      <span className="offline-panel__item-meta">
                        {formatDuration(asset.duration)} &middot;{' '}
                        {formatSize(asset.size)}
                        {asset.isIncomplete && (
                          <span className="offline-panel__item-incomplete">
                            {' '}
                            (incomplete)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="offline-panel__item-actions">
                      <button
                        type="button"
                        className="offline-panel__btn offline-panel__btn--play"
                        onClick={() => handlePlayOffline(asset)}
                        disabled={
                          asset.isIncomplete || (!delegatePlayback && !player)
                        }
                        title={
                          asset.isIncomplete
                            ? 'Download is incomplete — delete and re-download'
                            : delegatePlayback || player
                              ? 'Play offline'
                              : 'Player not ready'
                        }
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="offline-panel__btn offline-panel__btn--delete"
                        onClick={() => handleDelete(asset.offlineUri)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            !downloading && (
              <p className="offline-panel__empty">
                No downloads yet. Download a source above to watch it without an
                internet connection.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

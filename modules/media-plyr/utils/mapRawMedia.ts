import type {
  MediaSource,
  MediaMimeType,
  RawMedia,
  RawManifest,
} from '../types/index.ts';

function mapManifest(
  manifest: RawManifest | undefined,
  container: 'hls' | 'dash',
  defaultMime: MediaMimeType,
): MediaSource[] {
  if (!manifest?.url) return [];
  return [{
    container,
    url: manifest.url,
    mimeType: (manifest.mimeType as MediaMimeType) ?? defaultMime,
  }];
}

/**
 * Convert a `RawMedia` object into the flat `MediaSource[]` array the
 * player expects. Only HLS and DASH manifests are supported.
 */
export function mapRawMediaToSources(media: RawMedia): MediaSource[] {
  return [
    ...mapManifest(media.m3u8, 'hls', 'application/vnd.apple.mpegurl'),
    ...mapManifest(media.mpd, 'dash', 'application/dash+xml'),
  ];
}

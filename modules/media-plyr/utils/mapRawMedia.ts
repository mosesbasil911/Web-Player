import type {
  MediaSource,
  MediaMimeType,
  RawMedia,
  RawHlsMedia,
  RawProgressiveMedia,
} from '../types/index.ts';

function mapHls(hls: RawHlsMedia | undefined): MediaSource[] {
  if (!hls?.url) return [];
  return [{
    container: 'hls',
    mimeType: hls.mimeType as MediaMimeType,
    url: hls.url,
  }];
}

function mapProgressive(
  media: RawProgressiveMedia | undefined,
  container: 'mp4' | 'webm',
): MediaSource[] {
  if (!media?.qualities?.length) return [];
  const mimeType = media.mimeType as MediaMimeType;
  return media.qualities.map((q) => ({
    container,
    mimeType,
    url: q.url,
    bitrate: q.bitrate,
    size: q.size,
    resolution: q.resolution,
  }));
}

/**
 * Convert a `RawMedia` object (per-format objects with quality variants)
 * into the flat `MediaSource[]` array the player expects.
 */
export function mapRawMediaToSources(media: RawMedia): MediaSource[] {
  return [
    ...mapHls(media.m3u8),
    ...mapProgressive(media.webm, 'webm'),
    ...mapProgressive(media.mp4, 'mp4'),
  ];
}

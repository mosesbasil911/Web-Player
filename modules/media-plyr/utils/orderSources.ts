import type { MediaSource, SourceContainer } from '../types/index.ts';

export const DEFAULT_SOURCE_ORDER: SourceContainer[] = [
  'hls', 'dash', 'webm', 'mp4', 'mp3', 'aac', 'ogg',
];

export function orderSources(
  sources: MediaSource[],
  preferredOrder: SourceContainer[] = DEFAULT_SOURCE_ORDER,
): MediaSource[] {
  const rank = new Map(preferredOrder.map((c, i) => [c, i]));
  const fallback = preferredOrder.length + 1;

  return [...sources].sort((a, b) => {
    const aRank = rank.get(a.container) ?? fallback;
    const bRank = rank.get(b.container) ?? fallback;
    if (aRank !== bRank) return aRank - bRank;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });
}

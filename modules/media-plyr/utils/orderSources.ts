import type { MediaSource, SourceContainer } from '../types/index.ts';

/**
 * Default manifest preference. HLS first — Shaka handles HLS via MSE on all
 * modern browsers and falls back to native `video.src=` on iOS Safari, so
 * HLS-first is safe everywhere without device-specific branching.
 */
export const DEFAULT_SOURCE_ORDER: SourceContainer[] = ['hls', 'dash'];

export function orderSources(
  sources: MediaSource[],
  preferredOrder: SourceContainer[] = DEFAULT_SOURCE_ORDER,
): MediaSource[] {
  const rank = new Map(preferredOrder.map((c, i) => [c, i]));
  const fallback = preferredOrder.length + 1;

  return [...sources].sort((a, b) => {
    const aRank = rank.get(a.container) ?? fallback;
    const bRank = rank.get(b.container) ?? fallback;
    return aRank - bRank;
  });
}

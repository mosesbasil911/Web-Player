import { useEffect, useMemo, useRef, useState } from 'react';
import { parseVtt, type VttCue } from '../utils/parseVtt.ts';
import type { LyricsTrack } from '../types/index.ts';

interface LyricsPanelProps {
  lyrics: LyricsTrack | null | undefined;
  currentTime: number;
  /** Toggled by the parent (queue panel button etc.). */
  visible: boolean;
}

/**
 * Find the index of the cue active at `time` using a binary search over the
 * sorted-by-startTime cue list. Returns -1 before the first cue starts.
 *
 * We treat cues as continuing until the next cue starts (rather than
 * strictly ending at `cue.endTime`) so the active line stays highlighted
 * during silence between lyric lines — closer to how listeners experience
 * a song.
 */
function findActiveCue(cues: VttCue[], time: number): number {
  if (cues.length === 0) return -1;
  if (time < cues[0].startTime) return -1;

  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    const nextStart =
      mid + 1 < cues.length ? cues[mid + 1].startTime : Infinity;
    if (time < cue.startTime) {
      hi = mid - 1;
    } else if (time >= nextStart) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

export function LyricsPanel({
  lyrics,
  currentTime,
  visible,
}: LyricsPanelProps) {
  const [cues, setCues] = useState<VttCue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const lastActiveRef = useRef<number>(-1);

  // Reset on lyrics-source change
  const currentSrc = lyrics?.src ?? null;
  const [trackedSrc, setTrackedSrc] = useState(currentSrc);
  if (trackedSrc !== currentSrc) {
    setTrackedSrc(currentSrc);
    setCues([]);
    setError(null);
    setLoading(!!lyrics);
  }

  useEffect(() => {
    if (!lyrics) return;

    let cancelled = false;

    fetch(lyrics.src, { credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseVtt(text);
        setCues(parsed);
        setLoading(false);
        lastActiveRef.current = -1;
      })
      .catch((err) => {
        if (cancelled) return;
        setCues([]);
        setError(err instanceof Error ? err.message : 'Failed to load lyrics');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lyrics]);

  const activeIndex = useMemo(
    () => findActiveCue(cues, currentTime),
    [cues, currentTime],
  );

  // Karaoke-style auto-scroll: keep the active line centered. We only
  // scroll when the active line CHANGES, otherwise we fight the user
  // scrolling manually mid-song.
  useEffect(() => {
    if (!visible) return;
    if (activeIndex === lastActiveRef.current) return;
    lastActiveRef.current = activeIndex;
    if (activeIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.children.item(activeIndex) as HTMLElement | null;
    if (!activeEl) return;
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex, visible]);

  if (!visible || !lyrics) return null;

  return (
    <div className="media-plyr-audio__lyrics" role="region" aria-label="Lyrics">
      <div className="media-plyr-audio__lyrics-header">
        <span className="media-plyr-audio__lyrics-title">Lyrics</span>
      </div>

      {loading && (
        <div className="media-plyr-audio__lyrics-state">Loading lyrics…</div>
      )}
      {error && !loading && (
        <div className="media-plyr-audio__lyrics-state media-plyr-audio__lyrics-state--error">
          Couldn't load lyrics ({error})
        </div>
      )}
      {!loading && !error && cues.length === 0 && (
        <div className="media-plyr-audio__lyrics-state">
          No lyrics available.
        </div>
      )}

      {cues.length > 0 && (
        <ol className="media-plyr-audio__lyrics-list" ref={listRef}>
          {cues.map((cue, i) => {
            const isActive = i === activeIndex;
            const isPast = activeIndex >= 0 && i < activeIndex;
            return (
              <li
                key={cue.index}
                className={[
                  'media-plyr-audio__lyrics-line',
                  isActive ? 'media-plyr-audio__lyrics-line--active' : '',
                  isPast ? 'media-plyr-audio__lyrics-line--past' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isActive ? 'true' : undefined}
              >
                {cue.text.split('\n').map((part, j) => (
                  <span key={j} className="media-plyr-audio__lyrics-line-text">
                    {part}
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Minimal WebVTT parser. Used for lyrics — we deliberately implement this
 * rather than going through Shaka so the lyrics pipeline stays decoupled
 * from caption rendering and works on plain `<audio>` without wiring up a
 * Shaka videoContainer.
 *
 * Supports the subset that real-world lyric files use:
 *   - `WEBVTT` header (any `\r\n`/`\n`/`\n\n` pattern)
 *   - Optional cue identifier
 *   - `HH:MM:SS.mmm --> HH:MM:SS.mmm` and `MM:SS.mmm --> MM:SS.mmm`
 *   - Multi-line cue payloads
 *   - Inline tag stripping (`<v Speaker>`, `<i>`, etc.) for clean rendering
 *
 * Does NOT parse cue settings (alignment, position, etc.) — lyrics don't
 * need them and mishandling them silently is worse than ignoring them.
 */

export interface VttCue {
  /** Index in the original file (0-based), useful as a stable React key. */
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

const TIMING_LINE = /^(\d{1,2}:)?(\d{1,2}):(\d{2})\.(\d{1,3})\s*-->\s*(\d{1,2}:)?(\d{1,2}):(\d{2})\.(\d{1,3})/;

function toSeconds(
  hours: string | undefined,
  minutes: string,
  seconds: string,
  millis: string,
): number {
  const h = hours ? parseInt(hours, 10) : 0;
  const m = parseInt(minutes, 10);
  const s = parseInt(seconds, 10);
  const ms = parseInt(millis.padEnd(3, '0').slice(0, 3), 10);
  return h * 3600 + m * 60 + s + ms / 1000;
}

function stripInlineTags(line: string): string {
  return line.replace(/<[^>]*>/g, '');
}

export function parseVtt(input: string): VttCue[] {
  const text = input.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const cues: VttCue[] = [];

  let i = 0;
  // Skip the optional `WEBVTT` header + any header metadata block.
  if (lines[i]?.startsWith('WEBVTT')) {
    i++;
    while (i < lines.length && lines[i].trim() !== '') i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  let cueIndex = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    let line = lines[i];
    let timing = line.match(TIMING_LINE);
    // First non-blank line might be a cue identifier — peek ahead.
    if (!timing && i + 1 < lines.length) {
      const next = lines[i + 1].match(TIMING_LINE);
      if (next) {
        i++;
        line = lines[i];
        timing = next;
      }
    }

    if (!timing) {
      // Skip any line we can't classify. Keeps malformed VTT from
      // poisoning the rest of the file.
      i++;
      continue;
    }

    const startTime = toSeconds(timing[1]?.replace(':', ''), timing[2], timing[3], timing[4]);
    const endTime = toSeconds(timing[5]?.replace(':', ''), timing[6], timing[7], timing[8]);
    i++;

    const payload: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      payload.push(stripInlineTags(lines[i]));
      i++;
    }

    const cueText = payload.join('\n').trim();
    if (cueText.length > 0) {
      cues.push({ index: cueIndex++, startTime, endTime, text: cueText });
    }
  }

  return cues;
}

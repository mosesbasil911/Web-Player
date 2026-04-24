import { useState, useMemo } from 'react';
import { VideoPlayer } from '@media-plyr/index.ts';
import { AudioPlayer } from '@media-plyr/components/AudioPlayer.tsx';
import { useGlobalMute } from '@media-plyr/hooks/useGlobalMute.ts';
import type {
  MediaPlyrConfig,
  MediaSource,
  MediaTrack,
} from '@media-plyr/types/index.ts';
import './App.css';

interface DemoSource {
  label: string;
  config: MediaPlyrConfig;
}

const DEMO_SOURCES: DemoSource[] = [
  {
    label: 'Mux HLS Test Stream',
    config: {
      kind: 'video',
      sources: [
        {
          container: 'hls',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        },
      ],
      title: 'Mux HLS Test Stream',
      autoplay: false,
      poster:
        'https://peach.blender.org/wp-content/uploads/title_anouncement.thumbnail.jpg',
      playbackMemory: { enabled: true },
    },
  },
  {
    label: 'Big Buck Bunny (DASH)',
    config: {
      kind: 'video',
      sources: [
        {
          container: 'dash',
          url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
        },
      ],
      title: 'Angel One (Shaka Demo, DASH)',
      autoplay: false,
    },
  },
  {
    label: 'Sintel (DASH + HLS)',
    config: {
      kind: 'video',
      sources: [
        {
          container: 'hls',
          url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        },
        {
          container: 'dash',
          url: 'https://bitdash-a.akamaihd.net/content/sintel/sintel.mpd',
        },
      ],
      title: 'Sintel — HLS preferred on iOS, DASH elsewhere',
      autoplay: false,
    },
  },
];

const AUDIO_PLAYLIST: MediaTrack[] = [
  {
    kind: 'audio',
    sources: [
      {
        container: 'hls',
        url: 'https://res.cloudinary.com/dqgupihre/video/upload/audio_59f661d849_r8kqv6.m3u8',
      },
    ],
    title: 'Design aesthetics',
    artist: 'MusicWord',
    artwork:
      'https://t4.ftcdn.net/jpg/03/10/69/39/240_F_310693986_tGNIg4QkdTYC52Yb8yOAd3kzT8QivNUf.jpg',
  },
  {
    kind: 'audio',
    sources: [
      {
        container: 'hls',
        url: 'https://res.cloudinary.com/dqgupihre/video/upload/audio_4606c2ac46_wrulq4.m3u8',
      },
    ],
    title: 'Toxins Machine For The Engine',
    artist: 'agerabeatz',
    artwork:
      'https://t4.ftcdn.net/jpg/03/22/01/93/360_F_322019328_tpDuVYkRn16v58rWHjCjvS10yBoGuBIe.jpg',
  },
  {
    kind: 'audio',
    sources: [
      {
        container: 'hls',
        url: 'https://res.cloudinary.com/dqgupihre/video/upload/audio_b069c2dbf5_gfiytn.m3u8',
      },
    ],
    title: '24Hours in Birmingham',
    artist: 'Jason Watkins',
    poster:
      'https://t3.ftcdn.net/jpg/04/73/82/74/240_F_473827438_sQmZTzoB4BQn55PRjaQOomEX8KMc54Pd.jpg',
  },
  {
    kind: 'audio',
    sources: [
      {
        container: 'hls',
        url: 'https://res.cloudinary.com/dqgupihre/video/upload/audio_bf213674de_xso1go.m3u8',
      },
    ],
    title: 'Driving 400 Miles to visit my Girlfriend',
    artist: 'Rush',
    artwork:
      'https://t3.ftcdn.net/jpg/02/15/61/70/240_F_215617098_sL5O83EOk37hP9oyg3r6KIyks56XHFvz.jpg',
  },
  {
    kind: 'audio',
    sources: [
      {
        container: 'hls',
        url: 'https://res.cloudinary.com/dqgupihre/video/upload/audio_2dc7acd418_vsbkw9.m3u8',
      },
    ],
    title: 'The Rains of Castamere',
    artist: 'Ramin Djawadi',
    poster:
      'https://t3.ftcdn.net/jpg/03/22/00/50/240_F_322005085_9A9wPbYGOIPXoCj6arG4t7O2JZ3V9Io8.jpg',
  },
];

const AUDIO_BASE_CONFIG: MediaPlyrConfig = {
  kind: 'audio',
  sources: AUDIO_PLAYLIST[0].sources,
  title: AUDIO_PLAYLIST[0].title,
  autoplay: false,
};

const CROSSFADE_DURATION_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '2s', value: 2000 },
  { label: '4s', value: 4000 },
  { label: '8s', value: 8000 },
];

const CUSTOM_VALUE = '__custom__';

function inferKind(url: string): MediaPlyrConfig['kind'] {
  return /\/audio/i.test(url) ? 'audio' : 'video';
}

function inferSource(url: string): MediaSource | null {
  if (/\.m3u8(\?|$)/i.test(url)) {
    return { container: 'hls', url };
  }
  if (/\.mpd(\?|$)/i.test(url)) {
    return { container: 'dash', url };
  }
  return null;
}

type DemoMode = 'video' | 'audio';

function App() {
  const [mode, setMode] = useState<DemoMode>('video');
  const [selected, setSelected] = useState('0');
  const [customUrl, setCustomUrl] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [crossfadeMs, setCrossfadeMs] = useState<number>(4000);
  const { muted: globalMuted, toggle: toggleGlobalMute } = useGlobalMute();

  const audioConfig = useMemo<MediaPlyrConfig>(
    () => ({
      ...AUDIO_BASE_CONFIG,
      crossfade:
        crossfadeMs > 0
          ? { enabled: true, durationMs: crossfadeMs }
          : { enabled: false },
    }),
    [crossfadeMs],
  );

  const activeConfig: MediaPlyrConfig | null = useMemo(() => {
    if (selected !== CUSTOM_VALUE) {
      return DEMO_SOURCES[Number(selected)].config;
    }
    const trimmed = customUrl.trim();
    if (!trimmed) return null;
    const source = inferSource(trimmed);
    if (!source) return null;
    return {
      kind: inferKind(trimmed),
      sources: [source],
      title: 'Custom Source',
      autoplay: false,
    };
  }, [selected, customUrl]);

  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setCustomUrlError(null);
      return;
    }
    setCustomUrlError(
      inferSource(trimmed)
        ? null
        : 'URL must be an .m3u8 (HLS) or .mpd (DASH) manifest.',
    );
  };

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>mediaPlyr</h1>
        <p>
          Demo of mediaPlyr, a high-performance streaming media player
          <br /> built on Shaka. HLS and DASH manifests only.
        </p>
        <button
          type="button"
          className="demo-global-mute"
          onClick={toggleGlobalMute}
          aria-pressed={globalMuted}
        >
          Global mute: {globalMuted ? 'ON' : 'OFF'}
        </button>
      </header>

      <nav className="demo-toggle" role="tablist" aria-label="Player mode">
        <button
          role="tab"
          className={`demo-toggle__btn${mode === 'video' ? ' demo-toggle__btn--active' : ''}`}
          aria-selected={mode === 'video'}
          onClick={() => setMode('video')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Video
        </button>
        <button
          role="tab"
          className={`demo-toggle__btn${mode === 'audio' ? ' demo-toggle__btn--active' : ''}`}
          aria-selected={mode === 'audio'}
          onClick={() => setMode('audio')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Audio
        </button>
      </nav>

      <main className="demo-content">
        {mode === 'video' && (
          <>
            <div className="source-picker">
              <label htmlFor="source-select">Source</label>
              <select
                id="source-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {DEMO_SOURCES.map((s, i) => (
                  <option key={i} value={String(i)}>
                    {s.label}
                  </option>
                ))}
                <option value={CUSTOM_VALUE}>Custom URL…</option>
              </select>

              {selected === CUSTOM_VALUE && (
                <>
                  <input
                    className="custom-url-input"
                    type="url"
                    placeholder="Paste an HLS (.m3u8) or DASH (.mpd) manifest URL"
                    value={customUrl}
                    onChange={(e) => handleCustomUrlChange(e.target.value)}
                    aria-invalid={customUrlError ? 'true' : 'false'}
                  />
                  {customUrlError && (
                    <p className="custom-url-error" role="alert">
                      {customUrlError}
                    </p>
                  )}
                </>
              )}
            </div>

            <section className="demo-section">
              {activeConfig ? (
                <VideoPlayer
                  key={activeConfig.sources
                    .map((source) => source.url)
                    .join('|')}
                  config={activeConfig}
                />
              ) : (
                <div className="empty-state">
                  Enter an HLS or DASH manifest URL above to start playback
                </div>
              )}
            </section>
          </>
        )}

        {mode === 'audio' && (
          <>
            <div className="source-picker">
              <label htmlFor="crossfade-select">Crossfade</label>
              <select
                id="crossfade-select"
                value={String(crossfadeMs)}
                onChange={(e) => setCrossfadeMs(Number(e.target.value))}
              >
                {CROSSFADE_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="source-picker__hint">
                Pre-buffers the next track and ramps volumes during the
                transition. Requires VOD audio (radio streams have no fixed
                duration so the trigger never fires).
              </span>
            </div>

            <section className="demo-section">
              <AudioPlayer config={audioConfig} playlist={AUDIO_PLAYLIST} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

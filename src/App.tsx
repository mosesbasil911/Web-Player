import { useState, useMemo } from "react";
import { VideoPlayer } from "@media-plyr/index.ts";
import { AudioPlayer } from "@media-plyr/components/AudioPlayer.tsx";
import type {
  MediaPlyrConfig,
  MediaSource,
  MediaTrack,
} from "@media-plyr/types/index.ts";
import "./App.css";

interface DemoSource {
  label: string;
  config: MediaPlyrConfig;
}

const DEMO_SOURCES: DemoSource[] = [
  {
    label: "Popeye meets Sinbad (MP4)",
    config: {
      kind: "video",
      sources: [
        {
          container: "mp4",
          mimeType: "video/mp4",
          // url: "https://files.inqscribe.com/samples/IS_Intro.mp4",
          url: "https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00068306/00068306.mp4",
        },
      ],
      title: "Popeye the Sailor meets Sinbad the Sailor",
      poster:
        "https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00068306/00068306.jpg",
      autoplay: false,
      playbackMemory: {
        enabled: true,
      },
    },
  },
  {
    label: "Redcliff 450 (WEBM)",
    config: {
      kind: "video",
      sources: [
        {
          container: "webm",
          mimeType: "video/webm",
          url: "https://permadi.com/thirdParty/videos/redcliff450.webm",
        },
      ],
      title: "Redcliff 450",
      poster:
        "https://m.media-amazon.com/images/M/MV5BMTcyOTQ3NDA1OV5BMl5BanBnXkFtZTcwMDY3NzM4Mg@@._V1_FMjpg_UX1000_.jpg",
      autoplay: false,
    },
  },

  {
    label: "Mux HLS Test Stream",
    config: {
      kind: "video",
      sources: [
        {
          container: "hls",
          mimeType: "application/vnd.apple.mpegurl",
          url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        },
      ],
      title: "Mux HLS Test Stream",
      autoplay: false,
      poster:
        "https://peach.blender.org/wp-content/uploads/title_anouncement.thumbnail.jpg",
    },
  },
];

const AUDIO_PLAYLIST: MediaTrack[] = [
  {
    kind: "audio",
    sources: [
      {
        container: "mp3",
        mimeType: "audio/mpeg",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
    ],
    title: "SoundHelix Song 1",
    artist: "T. Schürger",
    duration: 375,
  },
  {
    kind: "audio",
    sources: [
      {
        container: "mp3",
        mimeType: "audio/mpeg",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      },
    ],
    title: "SoundHelix Song 2",
    artist: "T. Schürger",
    duration: 342,
  },
  {
    kind: "audio",
    sources: [
      {
        container: "mp3",
        mimeType: "audio/mpeg",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      },
    ],
    title: "SoundHelix Song 3",
    artist: "T. Schürger",
    duration: 295,
  },
  {
    kind: "audio",
    sources: [
      {
        container: "mp3",
        mimeType: "audio/mpeg",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      },
    ],
    title: "SoundHelix Song 6",
    artist: "T. Schürger",
    duration: 325,
  },
];

const AUDIO_BASE_CONFIG: MediaPlyrConfig = {
  kind: "audio",
  sources: AUDIO_PLAYLIST[0].sources,
  title: AUDIO_PLAYLIST[0].title,
  autoplay: false,
};

const CUSTOM_VALUE = "__custom__";

function inferKind(url: string): MediaPlyrConfig["kind"] {
  if (/\.(mp3|aac|ogg)(\?|$)/i.test(url)) return "audio";
  return "video";
}

function inferSource(url: string): MediaSource {
  if (/\.m3u8(\?|$)/i.test(url)) {
    return { container: "hls", mimeType: "application/vnd.apple.mpegurl", url };
  }
  if (/\.mpd(\?|$)/i.test(url)) {
    return { container: "dash", mimeType: "application/dash+xml", url };
  }
  if (/\.webm(\?|$)/i.test(url)) {
    return { container: "webm", mimeType: "video/webm", url };
  }
  if (/\.mp3(\?|$)/i.test(url)) {
    return { container: "mp3", mimeType: "audio/mpeg", url };
  }
  if (/\.aac(\?|$)/i.test(url)) {
    return { container: "aac", mimeType: "audio/aac", url };
  }
  if (/\.ogg(\?|$)/i.test(url)) {
    return { container: "ogg", mimeType: "audio/ogg", url };
  }
  return { container: "mp4", mimeType: "video/mp4", url };
}

type DemoMode = "video" | "audio";

function App() {
  const [mode, setMode] = useState<DemoMode>("video");
  const [selected, setSelected] = useState("0");
  const [customUrl, setCustomUrl] = useState("");

  const activeConfig: MediaPlyrConfig | null = useMemo(() => {
    if (selected !== CUSTOM_VALUE) {
      return DEMO_SOURCES[Number(selected)].config;
    }
    const trimmed = customUrl.trim();
    if (!trimmed) return null;
    return {
      kind: inferKind(trimmed),
      sources: [inferSource(trimmed)],
      title: "Custom Source",
      autoplay: false,
    };
  }, [selected, customUrl]);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>mediaPlyr</h1>
        <p>
          Demo of mediaPlyr, a high-performance media
          <br /> player built on top of Shaka-Player.
        </p>
      </header>

      <nav className="demo-toggle" role="tablist" aria-label="Player mode">
        <button
          role="tab"
          className={`demo-toggle__btn${mode === "video" ? " demo-toggle__btn--active" : ""}`}
          aria-selected={mode === "video"}
          onClick={() => setMode("video")}
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
          className={`demo-toggle__btn${mode === "audio" ? " demo-toggle__btn--active" : ""}`}
          aria-selected={mode === "audio"}
          onClick={() => setMode("audio")}
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
        {mode === "video" && (
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
                <input
                  className="custom-url-input"
                  type="url"
                  placeholder="Paste media URL (.mp4, .webm, .m3u8, .mpd, .mp3, .aac)"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              )}
            </div>

            <section className="demo-section">
              {activeConfig ? (
                <VideoPlayer
                  key={activeConfig.sources
                    .map((source) => source.url)
                    .join("|")}
                  config={activeConfig}
                />
              ) : (
                <div className="empty-state">
                  Enter a URL above to start playback
                </div>
              )}
            </section>
          </>
        )}

        {mode === "audio" && (
          <section className="demo-section">
            <AudioPlayer config={AUDIO_BASE_CONFIG} playlist={AUDIO_PLAYLIST} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

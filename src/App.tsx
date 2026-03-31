import { useState, useMemo } from "react";
import { VideoPlayer } from "@media-plyr/index.ts";
import type { MediaPlyrConfig, MediaSource } from "@media-plyr/types/index.ts";
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

function App() {
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

      <main className="demo-content">
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
              key={activeConfig.sources.map((source) => source.url).join("|")}
              config={activeConfig}
            />
          ) : (
            <div className="empty-state">
              Enter a URL above to start playback
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

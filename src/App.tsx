import { useState, useMemo } from "react";
import { VideoPlayer } from "@media-plyr/index.ts";
import type { MediaPlyrConfig } from "@media-plyr/types/index.ts";
import "./App.css";

interface DemoSource {
  label: string;
  config: MediaPlyrConfig;
}

const DEMO_SOURCES: DemoSource[] = [
  {
    label: "Big Buck Bunny (MP4)",
    config: {
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      type: "video/mp4",
      title: "Big Buck Bunny",
      poster:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
      autoplay: false,
    },
  },
  {
    label: "Mux HLS Test Stream",
    config: {
      src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      type: "application/x-mpegURL",
      title: "Mux HLS Test Stream",
      autoplay: false,
      poster:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
    },
  },
];

const CUSTOM_VALUE = "__custom__";

function inferType(url: string): MediaPlyrConfig["type"] {
  if (/\.m3u8(\?|$)/i.test(url)) return "application/x-mpegURL";
  if (/\.mpd(\?|$)/i.test(url)) return "application/dash+xml";
  return "video/mp4";
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
      src: trimmed,
      type: inferType(trimmed),
      title: "Custom Source",
      autoplay: false,
    };
  }, [selected, customUrl]);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>mediaPlyr</h1>
        <p>Week 1 — Core Shaka Integration Demo</p>
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
              placeholder="Paste a video URL (.mp4, .m3u8, .mpd)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          )}
        </div>

        <section className="demo-section">
          {activeConfig ? (
            <VideoPlayer key={activeConfig.src} config={activeConfig} />
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

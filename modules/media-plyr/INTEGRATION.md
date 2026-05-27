# media-plyr — Integration Guide

This guide explains how to copy **media-plyr** into your own project and wire it to a custom UI. React is **not required** — the React app in the repo root (`src/`) is a demo only.

## Overview

media-plyr is a TypeScript media player built on [Shaka Player](https://github.com/shaka-project/shaka-player). It handles **adaptive streaming manifests only**:

| Supported     | Not supported   |
| ------------- | --------------- |
| HLS (`.m3u8`) | Progressive MP4 |
| DASH (`.mpd`) | WebM, MP3, etc. |

Tested on modern Chrome, Edge, Firefox, and Safari. On iOS Safari, provide an HLS manifest — Shaka falls back to native playback when MSE is restricted.

---

## What to copy

Copy the entire `modules/media-plyr/` folder into your repo. Then install the runtime dependency:

```bash
npm install shaka-player
# or
pnpm add shaka-player
```

### Folder guide

| Path                    | Required? | Purpose                                                                                         |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `core/`                 | **Yes**   | `MediaPlyr` engine, queue, playback memory, crossfade                                           |
| `integrations/`         | Optional  | Cast, offline downloads, OS media session                                                       |
| `utils/`                | **Yes**   | Helpers (`formatTime`, `mapRawMediaToSources`, etc.)                                            |
| `types/`                | **Yes**   | TypeScript definitions                                                                          |
| `styles/media-plyr.css` | Optional  | Caption styling + reference UI tokens (only needed if you use Shaka's built-in caption overlay) |
| `components/`           | Skip      | React UI — reference only                                                                       |
| `hooks/`                | Skip      | React hooks — reference only                                                                    |
| `index.ts`              | Optional  | Barrel re-export; you can import from subpaths directly                                         |

**You do not need React** unless you choose to reuse the pre-built React components.

---

## Quick start (vanilla TypeScript / JavaScript)

### 1. HTML

Wrap the media element in a container div. Shaka renders captions into the **parent** of the `<video>` element, so the wrapper is important for subtitle display.

```html
<div class="player-container">
  <video id="player" playsinline></video>
</div>
```

### 2. Create and attach the player

```typescript
import { MediaPlyr } from './media-plyr/core/MediaPlyr.ts';

const video = document.getElementById('player') as HTMLVideoElement;

const player = new MediaPlyr({
  kind: 'video',
  sources: [{ container: 'hls', url: 'https://example.com/stream.m3u8' }],
  title: 'My Stream',
  poster: 'https://example.com/poster.jpg',
  autoplay: false,
});

await player.attach(video);
```

For audio, use an `<audio>` element and set `kind: 'audio'`.

### 3. Wire your UI to events

```typescript
player.on('play', () => updatePlayButton(true));
player.on('pause', () => updatePlayButton(false));
player.on('ended', () => updatePlayButton(false));

player.on('timeupdate', () => {
  const { currentTime, duration, buffered } = player.getPlaybackState();
  updateSeekBar(currentTime, duration, buffered);
});

player.on('loaded', () => {
  enableControls();
});

player.on('error', (err) => {
  const error = err as { code: number; message: string; severity: string };
  showError(error.message);
});
```

### 4. Control playback from your buttons

```typescript
playBtn.addEventListener('click', () => player.play());
pauseBtn.addEventListener('click', () => player.pause());
seekBar.addEventListener('input', (e) => {
  player.seek(Number((e.target as HTMLInputElement).value));
});
volumeSlider.addEventListener('input', (e) => {
  player.setVolume(Number((e.target as HTMLInputElement).value));
});
```

### 5. Clean up on teardown

```typescript
player.destroy();
```

Always call `destroy()` when removing the player from the page (route change, component unmount, etc.) to release Shaka resources.

---

## Lifecycle

```
new MediaPlyr(config)
       │
       ▼
  attach(<video>|<audio>)  ──► loads manifest via Shaka
       │
       ├── on('loaded')     ──► safe to read duration, enable controls
       ├── on('play'|'pause'|'timeupdate'|…)
       │
  loadSource(newConfig)      ──► switch track without recreating player
       │
  destroy()                  ──► tear down Shaka + listeners
```

---

## Configuration (`MediaPlyrConfig`)

```typescript
interface MediaPlyrConfig {
  kind: 'video' | 'audio';
  sources: MediaSource[]; // required — at least one HLS or DASH manifest
  title: string;

  poster?: string;
  preferredOrder?: ('hls' | 'dash')[]; // default: ['hls', 'dash']
  crossOrigin?: 'anonymous' | 'use-credentials';
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  volume?: number; // 0–1
  startTime?: number; // seconds
  playbackRate?: PlaybackSpeed; // 0.25 – 2

  drm?: DrmConfig;
  cast?: CastConfig;
  ads?: AdsConfig;
  offline?: OfflineConfig;
  abr?: AbrConfig;
  streaming?: StreamingConfig;
  playbackMemory?: PlaybackMemoryConfig;
  crossfade?: CrossfadeConfig;
  subtitles?: SubtitleTrack[];
}
```

### Sources

Provide one or both manifest types per asset:

```typescript
sources: [
  { container: 'hls', url: 'https://cdn.example.com/movie.m3u8' },
  { container: 'dash', url: 'https://cdn.example.com/movie.mpd' },
];
```

If both are provided, HLS is preferred by default. On iOS Safari, **always include HLS** — DASH-only will likely fail because Shaka needs HLS to fall back to native `video.src` playback.

> **Warning:** Setting `preferredOrder: ['dash', 'hls']` on iOS Safari is unsupported and will likely cause playback failure.

### CMS / encoder payloads

If your backend returns a nested shape instead of a flat `sources` array, use the mapper:

```typescript
import { mapRawMediaToSources } from './media-plyr/utils/mapRawMedia.ts';

const raw = {
  poster: 'https://…',
  m3u8: { url: 'https://…/index.m3u8' },
  mpd: { url: 'https://…/index.mpd' },
};

const config: MediaPlyrConfig = {
  kind: 'video',
  sources: mapRawMediaToSources(raw),
  title: 'My Video',
  poster: raw.poster,
};
```

### Subtitles

Sidecar WebVTT tracks can be declared in config:

```typescript
subtitles: [
  {
    src: 'https://example.com/en.vtt',
    language: 'en',
    label: 'English',
    default: true,
  },
];
```

For caption visibility, call `player.setTextVisible(true)` and `player.selectTextTrack(id)`. If you import `styles/media-plyr.css`, caption show/hide is driven by a `data-captions-off` attribute on the video container.

### DRM

```typescript
drm: {
  servers: {
    'com.widevine.alpha': 'https://license.example.com/widevine',
    'com.microsoft.playready': 'https://license.example.com/playready',
  },
}
```

### Streaming / ABR

```typescript
streaming: {
  lowLatencyMode: true,   // for LL-HLS / LL-DASH live streams
  bufferingGoal: 30,
  rebufferingGoal: 2,
},
abr: {
  enabled: true,
  restrictions: { maxHeight: 1080 },
}
```

---

## Player API (`MediaPlyrInstance`)

| Method                        | Description                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `attach(element)`             | Bind to a `<video>` or `<audio>` element and load the manifest    |
| `loadSource(config)`          | Load a new manifest without destroying the player                 |
| `play()`                      | Start playback (returns a Promise; may reject on autoplay policy) |
| `pause()`                     | Pause playback                                                    |
| `stop()`                      | Pause and seek to 0                                               |
| `seek(time)`                  | Seek to position in seconds                                       |
| `setVolume(0–1)`              | Set volume                                                        |
| `setMuted(bool)`              | Mute / unmute                                                     |
| `setPlaybackRate(rate)`       | Set speed (0.25 – 2)                                              |
| `toggleFullscreen()`          | Enter / exit fullscreen on the video container                    |
| `togglePip()`                 | Enter / exit picture-in-picture (video only)                      |
| `getPlaybackState()`          | Snapshot of current playback state                                |
| `getTextTracks()`             | Available subtitle/caption tracks                                 |
| `selectTextTrack(id \| null)` | Select a track by id, or clear selection                          |
| `setTextVisible(bool)`        | Show / hide the active text track                                 |
| `isTextVisible()`             | Whether captions are currently visible                            |
| `on(event, callback)`         | Subscribe to an event                                             |
| `off(event, callback)`        | Unsubscribe                                                       |
| `destroy()`                   | Tear down the player                                              |
| `videoElement`                | The bound media element (readonly)                                |

---

## Events

| Event              | When it fires                           | Payload                   |
| ------------------ | --------------------------------------- | ------------------------- |
| `loading`          | A new source load begins (`loadSource`) | —                         |
| `loaded`           | Manifest loaded and ready               | —                         |
| `play`             | Playback starts or resumes              | `PlaybackState`           |
| `pause`            | Playback paused                         | `PlaybackState`           |
| `ended`            | Playback reached the end                | `PlaybackState`           |
| `timeupdate`       | Current time changed                    | `PlaybackState`           |
| `volumechange`     | Volume or mute changed                  | `PlaybackState`           |
| `ratechange`       | Playback rate changed                   | `PlaybackState`           |
| `seeking`          | Seek started                            | `PlaybackState`           |
| `seeked`           | Seek completed                          | `PlaybackState`           |
| `buffering`        | Waiting for data                        | `PlaybackState`           |
| `error`            | An error occurred                       | `MediaPlyrError`          |
| `destroy`          | Player is being destroyed               | —                         |
| `fullscreenchange` | Fullscreen entered/exited               | `{ fullscreen: boolean }` |
| `pipchange`        | PiP entered/exited                      | `{ pip: boolean }`        |
| `texttrackchange`  | Subtitle tracks changed                 | `TextTrackChangeEvent`    |
| `metadata`         | Timed metadata (e.g. ID3)               | `MediaMetadataEvent`      |
| `mute`             | Mute toggled via `setMuted`             | `{ muted: boolean }`      |

Queue, repeat, shuffle, cast, ad, and offline events are emitted by their respective manager classes (see below).

### `PlaybackState`

```typescript
{
  playing: boolean;
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  buffered: number; // end of the last buffered range
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  pip: boolean;
  seeking: boolean;
  waiting: boolean; // true while rebuffering
  casting: boolean; // updated by CastManager, not MediaPlyr directly
  castDeviceName: string | null;
}
```

---

## Building your own UI

The player does **not** render controls. You provide the DOM and wire it to the API above. The included React components (`VideoPlayer`, `AudioPlayer`, `ControlBar`, etc.) are a reference implementation you can study or adapt.

### Recommended DOM structure (video)

```html
<div class="player-container">
  <!-- Shaka renders captions here -->
  <video playsinline></video>
  <!-- your custom controls go here or outside the container -->
</div>
```

Set `crossOrigin="anonymous"` on the video element if your manifests or subtitles require CORS.

### Captions

Two approaches:

1. **Built-in Shaka overlay** — wrap the video in a container, import caption CSS from `styles/media-plyr.css`, and use `setTextVisible` / `selectTextTrack`.
2. **Roll your own** — listen to `texttrackchange` and fetch/parse VTT with `parseVtt()` from `utils/parseVtt.ts`.

### Switching tracks

```typescript
// Load a new track without recreating the player
await player.loadSource({
  kind: 'audio',
  sources: [{ container: 'hls', url: nextTrackUrl }],
  title: nextTrack.title,
});
```

---

## Optional integrations

These are standalone classes that take a `MediaPlyrInstance`. They follow the same lifecycle: construct → init (if needed) → listen → destroy.

### MediaSessionManager — OS media controls

Surfaces track info and transport controls on the lock screen, notification shade, hardware media keys, etc.

```typescript
import { MediaSessionManager } from './media-plyr/integrations/MediaSessionManager.ts';

const session = new MediaSessionManager(player, {
  onPrev: () => queue.prev(),
  onNext: () => queue.next(),
});

session.setMetadata({
  title: 'Track Name',
  artist: 'Artist',
  artwork: 'https://…',
});
session.bindActionHandlers();
session.startPositionUpdates();
session.setPlaybackState('playing');

// on teardown:
session.destroy();
```

### CastManager — Chromecast

Requires the Cast Web Sender SDK. `CastManager.init()` loads it automatically if not already present.

```typescript
import { CastManager } from './media-plyr/integrations/CastManager.ts';

if (CastManager.isSupported()) {
  const castMgr = new CastManager(player, {
    receiverApplicationId: 'CC1AD845', // default receiver; use your own in production
  });

  await castMgr.init();

  castMgr.on('caststate', (data) => {
    const event = data as { connected: boolean; deviceName: string | null };
    updateCastButton(event.connected, event.deviceName);
  });

  castButton.addEventListener('click', () => castMgr.requestSession());

  // on teardown:
  castMgr.destroy();
}
```

Cast is Chrome-only (not Edge). Pass `cast` in `MediaPlyrConfig` if you want the config available to the manager, but Cast is wired separately via `CastManager`.

### OfflineManager — download for offline playback

```typescript
import { OfflineManager } from './media-plyr/integrations/OfflineManager.ts';

if (OfflineManager.isSupported()) {
  const offline = new OfflineManager(player);

  offline.on('offlineprogress', (data) => {
    const { progress } = data as { progress: number };
    updateDownloadBar(progress);
  });

  const asset = await offline.download('https://example.com/stream.mpd', {
    mimeType: 'application/dash+xml',
    appMetadata: { title: 'My Video' },
    onProgress: (p) => console.log(p),
  });

  // Play back the downloaded asset:
  await player.loadSource({
    kind: 'video',
    sources: [{ container: 'dash', url: asset.offlineUri }],
    title: 'My Video (offline)',
  });

  // on teardown:
  await offline.destroy();
}
```

### QueueManager — playlist navigation

Framework-agnostic queue with repeat/shuffle support.

```typescript
import { QueueManager } from './media-plyr/core/QueueManager.ts';

const queue = new QueueManager(playlist);

queue.on('trackchange', async ({ track }) => {
  if (!track) return;
  await player.loadSource({
    kind: track.kind,
    sources: track.sources,
    title: track.title,
    subtitles: track.subtitles,
  });
});

nextBtn.addEventListener('click', () => queue.next());
prevBtn.addEventListener('click', () => queue.prev());
```

Public API: `next()`, `prev()`, `skipTo(index)`, `hasNext()`, `hasPrev()`, `setTracks()`, `addTrack()`, `removeTrack()`, `setRepeat()`, `setShuffle()`, `getState()`, `getCurrentTrack()`.

### PlaybackMemory — resume position

Persists playback position to `localStorage`.

```typescript
import { PlaybackMemory } from './media-plyr/core/PlaybackMemory.ts';

const memory = new PlaybackMemory({ enabled: true });

// Before attach — restore saved position:
const saved = memory.getSavedPosition(mediaId);
const config = saved ? { ...baseConfig, startTime: saved } : baseConfig;

const player = new MediaPlyr(config);
await player.attach(video);

// After attach — start saving:
memory.attach(video, mediaId);

// on teardown:
memory.detach();
```

### GlobalMuteManager — sync mute across players

```typescript
import { getDefaultGlobalMuteManager } from './media-plyr/core/GlobalMuteManager.ts';

const muteMgr = getDefaultGlobalMuteManager();

muteMgr.subscribe((muted) => {
  player.setMuted(muted);
});

muteBtn.addEventListener('click', () => muteMgr.toggle());
```

---

## Error codes

| Code  | Severity    | Meaning                                                  |
| ----- | ----------- | -------------------------------------------------------- |
| 1000  | fatal       | Browser not supported by Shaka                           |
| 1001  | recoverable | Autoplay blocked — user interaction required             |
| 1002  | fatal       | No sources provided                                      |
| 1003  | fatal       | No HLS/DASH manifest (progressive files not supported)   |
| 1100  | recoverable | A sidecar subtitle track failed to load                  |
| 9999  | fatal       | Unknown / unexpected error                               |
| Other | varies      | Shaka error codes — check `severity` on the error object |

Autoplay errors (1001) are recoverable — show a play button and call `player.play()` after user interaction.

---

## Setup in your repo

### TypeScript / bundler

Source files use `.ts` / `.tsx` extensions in import paths (e.g. `'./MediaPlyr.ts'`). This works with Vite, esbuild, and modern TypeScript (`moduleResolution: "bundler"`). If your toolchain rejects extensioned imports, strip the extensions or configure path aliases.

Example tsconfig paths:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@media-plyr/*": ["./media-plyr/*"]
    }
  }
}
```

### Dependencies

| Package              | Required | Notes                                   |
| -------------------- | -------- | --------------------------------------- |
| `shaka-player`       | **Yes**  | Match major version ^5.x                |
| `react`, `react-dom` | No       | Only if using `components/` or `hooks/` |

### Browser support check

```typescript
import { detectSupport } from './media-plyr/utils/detectSupport.ts';

const { browser } = detectSupport();
if (!browser.shaka) {
  showUnsupportedMessage();
}
```

### Styles

Import `styles/media-plyr.css` only if you want:

- Shaka caption overlay styling (`.shaka-text-container`)
- CSS variables for theming (`--plyr-accent`, etc.)

Your custom UI does not require this file.

---

## React demo (reference only)

The repo includes a React + Vite demo in `src/`. It uses pre-built components:

```tsx
import { VideoPlayer } from '@media-plyr/components/VideoPlayer.tsx';

<VideoPlayer
  config={myConfig}
  onReady={(player) => {
    /* access imperative API */
  }}
/>;
```

For custom UI in any framework (or no framework), use `MediaPlyr` directly as shown in the Quick Start above.

---

## Utilities

| Export                          | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `formatTime(seconds)`           | Format seconds as `m:ss` or `h:mm:ss`    |
| `mapRawMediaToSources(raw)`     | Convert CMS `RawMedia` → `MediaSource[]` |
| `orderSources(sources, order?)` | Sort manifests by preferred container    |
| `detectSupport()`               | Probe browser capabilities               |
| `parseVtt(url)`                 | Fetch and parse a WebVTT file into cues  |

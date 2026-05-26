# mediaPlyr

High-performance media player built on [Shaka Player](https://github.com/shaka-project/shaka-player) for adaptive HLS and DASH streaming (video and audio).

The React app in `src/` is a **demo only**. For integrating media-plyr into your own project with a custom UI, see **[Integration Guide](./modules/media-plyr/INTEGRATION.md)**.

## Quick links

- [Integration Guide](./modules/media-plyr/INTEGRATION.md) — copy into your repo, wire your own UI
- [Demo app](./src/App.tsx) — reference React implementation

## Supported formats

| Supported     | Not supported              |
| ------------- | -------------------------- |
| HLS (`.m3u8`) | Progressive MP4, WebM, MP3 |

DASH (`.mpd`) is also supported. Provide HLS alongside DASH for iOS Safari compatibility.

## Development

```bash
pnpm install
pnpm dev
```

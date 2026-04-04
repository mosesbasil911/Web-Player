import shaka from "shaka-player";

export interface BrowserSupport {
  shaka: boolean;
  mediaSource: boolean;
  video: boolean;
  audio: boolean;
  pip: boolean;
  fullscreen: boolean;
  airplay: boolean;
}

export interface CodecSupport {
  mp4: boolean;
  webm: boolean;
  hls: boolean;
  mp3: boolean;
  aac: boolean;
  ogg: boolean;
}

export interface DetectedSupport {
  browser: BrowserSupport;
  codecs: CodecSupport;
}

function canPlayType(element: HTMLMediaElement, type: string): boolean {
  const result = element.canPlayType(type);
  return result === "probably" || result === "maybe";
}

export function detectSupport(): DetectedSupport {
  const video = document.createElement("video");
  const audio = document.createElement("audio");

  const hasMSE =
    typeof window !== "undefined" && "MediaSource" in window;

  const browser: BrowserSupport = {
    shaka: shaka.Player.isBrowserSupported(),
    mediaSource: hasMSE,
    video: !!video.canPlayType,
    audio: !!audio.canPlayType,
    pip:
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document,
    fullscreen:
      typeof document !== "undefined" &&
      (!!document.fullscreenEnabled ||
        !!(document as unknown as Record<string, unknown>)
          .webkitFullscreenEnabled),
    airplay: "WebKitPlaybackTargetAvailabilityEvent" in window,
  };

  const codecs: CodecSupport = {
    mp4: canPlayType(video, 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    webm: canPlayType(video, 'video/webm; codecs="vp8, vorbis"'),
    hls:
      hasMSE || canPlayType(video, "application/vnd.apple.mpegurl"),
    mp3: canPlayType(audio, "audio/mpeg"),
    aac: canPlayType(audio, "audio/aac"),
    ogg: canPlayType(audio, 'audio/ogg; codecs="vorbis"'),
  };

  return { browser, codecs };
}

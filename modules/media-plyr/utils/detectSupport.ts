import shaka from "shaka-player";

export interface BrowserSupport {
  shaka: boolean;
  mediaSource: boolean;
  nativeHls: boolean;
  video: boolean;
  audio: boolean;
  pip: boolean;
  fullscreen: boolean;
  airplay: boolean;
}

export interface DetectedSupport {
  browser: BrowserSupport;
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
    nativeHls: canPlayType(video, "application/vnd.apple.mpegurl"),
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
    airplay: typeof window !== "undefined" &&
      "WebKitPlaybackTargetAvailabilityEvent" in window,
  };

  return { browser };
}

import type shaka from 'shaka-player';
import type { StreamingConfig } from '../types/index.ts';

/**
 * Applies media-plyr `StreamingConfig` to a Shaka player instance.
 * Shared by `MediaPlyr` and `CrossfadeEngine`.
 */
export function configureShakaStreaming(
  player: shaka.Player,
  sc?: StreamingConfig,
): void {
  const streamingConfig: Record<string, unknown> = {
    // Evict buffer more than 30 s behind the playhead so backward seeks
    // don't collide with stale SourceBuffer data (prevents
    // CHUNK_DEMUXER_ERROR_APPEND_FAILED on DASH).
    bufferBehind: sc?.bufferBehind ?? 30,
  };

  if (sc?.rebufferingGoal !== undefined) {
    streamingConfig.rebufferingGoal = sc.rebufferingGoal;
  }
  if (sc?.bufferingGoal !== undefined) {
    streamingConfig.bufferingGoal = sc.bufferingGoal;
  }
  if (sc?.lowLatencyMode !== undefined) {
    streamingConfig.lowLatencyMode = sc.lowLatencyMode;
  }
  if (sc?.retryParameters) {
    streamingConfig.retryParameters = sc.retryParameters;
  }
  if (sc?.preferNativeHls !== undefined) {
    streamingConfig.preferNativeHls = sc.preferNativeHls;
  }
  if (sc?.useNativeHlsForFairPlay !== undefined) {
    streamingConfig.useNativeHlsForFairPlay = sc.useNativeHlsForFairPlay;
  }

  player.configure('streaming', streamingConfig);
}

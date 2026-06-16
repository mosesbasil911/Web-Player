import shaka from 'shaka-player';
import type { StreamingConfig } from '../types/index.ts';

type StreamingRequestFilter = (
  type: number,
  request: { headers: Record<string, string>; allowCrossSiteCredentials?: boolean },
) => void;

interface NetworkingEngineLike {
  registerRequestFilter(filter: StreamingRequestFilter): void;
  unregisterRequestFilter(filter: StreamingRequestFilter): void;
}

/**
 * Attaches authorization headers (and optional credentials) to manifest and
 * segment requests via Shaka's networking-engine request filter. Use this
 * when a CDN/origin middleware validates JWTs or session cookies before
 * serving HLS/DASH payloads.
 *
 * Applies only on the MSE path — native HLS on iOS Safari bypasses Shaka's
 * networking stack, so header-based auth won't run there.
 *
 * Must be applied before `player.load()`. Re-call `apply()` when the token
 * or headers change (e.g. after `loadSource()` with refreshed config).
 */
export class StreamingAuthManager {
  private player: shaka.Player;
  private config: StreamingConfig;
  private requestFilter: StreamingRequestFilter | null = null;
  private applied = false;
  private destroyed = false;

  constructor(player: shaka.Player, config: StreamingConfig) {
    this.player = player;
    this.config = config;
  }

  apply(): void {
    if (this.applied || this.destroyed) return;

    this.applyRequestFilter();
    this.applied = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.requestFilter) {
      const engine = this.getNetworkingEngine();
      try {
        engine?.unregisterRequestFilter(this.requestFilter);
      } catch {
        // Engine may already be torn down with the player — ignore.
      }
      this.requestFilter = null;
    }
  }

  private applyRequestFilter(): void {
    const headers = this.config.requestHeaders;
    const withCredentials = this.config.withCredentials;
    if ((!headers || Object.keys(headers).length === 0) && !withCredentials) {
      return;
    }

    const engine = this.getNetworkingEngine();
    if (!engine) return;

    const { MANIFEST, SEGMENT } = this.getStreamingRequestTypes();

    this.requestFilter = (type, request) => {
      if (type !== MANIFEST && type !== SEGMENT) return;
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          request.headers[key] = value;
        }
      }
      if (withCredentials) {
        request.allowCrossSiteCredentials = true;
      }
    };

    engine.registerRequestFilter(this.requestFilter);
  }

  private getNetworkingEngine(): NetworkingEngineLike | null {
    const engine = (
      this.player as unknown as {
        getNetworkingEngine?: () => NetworkingEngineLike | null;
      }
    ).getNetworkingEngine?.();
    return engine ?? null;
  }

  private getStreamingRequestTypes(): { MANIFEST: number; SEGMENT: number } {
    return (
      shaka as unknown as {
        net: { NetworkingEngine: { RequestType: { MANIFEST: number; SEGMENT: number } } };
      }
    ).net.NetworkingEngine.RequestType;
  }
}

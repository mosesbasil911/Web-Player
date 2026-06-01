import shaka from 'shaka-player';
import type { DrmConfig } from '../types/index.ts';

type LicenseRequestFilter = (
  type: number,
  request: { headers: Record<string, string>; allowCrossSiteCredentials?: boolean },
) => void;

interface NetworkingEngineLike {
  registerRequestFilter(filter: LicenseRequestFilter): void;
  unregisterRequestFilter(filter: LicenseRequestFilter): void;
}

/**
 * DRM configuration passthrough for Shaka Player.
 *
 * The player is built on the principle that DRM is an *integration surface*,
 * not infrastructure: the client supplies license server URLs (and optionally
 * auth headers); Shaka performs the EME/CDM handshake. This class owns that
 * passthrough so the core `MediaPlyr` doesn't carry key-system logic inline.
 *
 * It does two things:
 *   1. Pushes `servers` + `advanced` into `player.configure({ drm })`.
 *   2. Registers a networking-engine request filter that attaches
 *      `licenseRequestHeaders` (and `withCredentials`) to LICENSE requests —
 *      the usual mechanism for passing an authorization token to a license
 *      proxy without hardcoding it into the manifest.
 *
 * Must be applied *before* `player.load()`, while the player is being
 * configured, so the CDM is provisioned with the right servers up front.
 *
 * Usage:
 *   const drm = new DrmManager(shakaPlayer, config.drm);
 *   drm.apply();
 *   // …on teardown…
 *   drm.destroy();
 */
export class DrmManager {
  private player: shaka.Player;
  private config: DrmConfig;
  private requestFilter: LicenseRequestFilter | null = null;
  private applied = false;
  private destroyed = false;

  constructor(player: shaka.Player, config: DrmConfig) {
    this.player = player;
    this.config = config;
  }

  /** Apply DRM servers/advanced config and (if any) the license header filter. */
  apply(): void {
    if (this.applied || this.destroyed) return;

    this.player.configure({
      drm: {
        servers: this.config.servers,
        advanced: this.config.advanced as Record<
          string,
          shaka.extern.AdvancedDrmConfiguration
        >,
      },
    });

    this.applyLicenseRequestFilter();
    this.applied = true;
  }

  /** Tear down the request filter so the player can be reconfigured/reused. */
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

  private applyLicenseRequestFilter(): void {
    const headers = this.config.licenseRequestHeaders;
    const withCredentials = this.config.withCredentials;
    if ((!headers || Object.keys(headers).length === 0) && !withCredentials) {
      return;
    }

    const engine = this.getNetworkingEngine();
    if (!engine) return;

    const licenseType = this.getLicenseRequestType();

    this.requestFilter = (type, request) => {
      if (type !== licenseType) return;
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

  private getLicenseRequestType(): number {
    return (
      shaka as unknown as {
        net: { NetworkingEngine: { RequestType: { LICENSE: number } } };
      }
    ).net.NetworkingEngine.RequestType.LICENSE;
  }
}

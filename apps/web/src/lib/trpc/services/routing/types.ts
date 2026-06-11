/**
 * Common contract for routing engines. Each provider (OSRM, IGN, ORS,
 * Google) implements `RoutingAdapter` and normalises its response to
 * `RouteResult` (distance km, duration s, geometry `[lng, lat][]`).
 *
 * ⚠️ Server-only: adapters carry API keys. Never import client-side.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Distance in kilometres (3 decimal places, as in existing trajets.calculateRoute). */
  distanceKm: number;
  /** Duration in seconds (integer). */
  durationSec: number;
  /** Route geometry in `[lng, lat][]` (GeoJSON/MapLibre order). */
  geometry: [number, number][];
}

export interface RouteOptions {
  /** API key already decrypted by the resolver (if the provider requires one). */
  apiKey?: string;
  /** Avoid highways/péages (maps the `peages === false` of trajets). */
  avoidTolls?: boolean;
  /** Cancellation/timeout. */
  signal?: AbortSignal;
}

export type RoutingProviderId = "osrm" | "ign" | "openrouteservice" | "google";

export interface RoutingAdapter {
  readonly id: RoutingProviderId;
  /** `true` if a per-tenant API key is required. */
  readonly requiresKey: boolean;
  /**
   * Computes ONE segment (origin -> destination). Primitive reused in a loop
   * by multi-arrêt trajets. Returns `null` on recoverable failure
   * (network, no route, key absent).
   */
  computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null>;
}

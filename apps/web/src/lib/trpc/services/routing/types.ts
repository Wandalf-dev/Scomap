/**
 * Contrat commun des moteurs de routing. Chaque provider (OSRM, IGN, ORS,
 * Google) implémente `RoutingAdapter` et normalise sa réponse vers
 * `RouteResult` (distance km, durée s, géométrie `[lng, lat][]`).
 *
 * ⚠️ Server-only : les adaptateurs portent des clés d'API. Ne jamais importer
 * côté client.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Distance en kilomètres (3 décimales, comme l'existant trajets.calculateRoute). */
  distanceKm: number;
  /** Durée en secondes (entier). */
  durationSec: number;
  /** Géométrie de l'itinéraire en `[lng, lat][]` (ordre GeoJSON/MapLibre). */
  geometry: [number, number][];
}

export interface RouteOptions {
  /** Clé d'API déjà déchiffrée par le resolver (si le provider en exige une). */
  apiKey?: string;
  /** Éviter les autoroutes/péages (mappe le `peages === false` des trajets). */
  avoidTolls?: boolean;
  /** Annulation/timeout. */
  signal?: AbortSignal;
}

export type RoutingProviderId = "osrm" | "ign" | "openrouteservice" | "google";

export interface RoutingAdapter {
  readonly id: RoutingProviderId;
  /** `true` si une clé d'API par tenant est nécessaire. */
  readonly requiresKey: boolean;
  /**
   * Calcule UN segment (origine -> destination). Primitive réutilisée en boucle
   * par les trajets multi-arrêts. Renvoie `null` sur échec récupérable
   * (réseau, pas d'itinéraire, clé absente).
   */
  computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null>;
}

import type {
  LatLng,
  RouteOptions,
  RouteResult,
  RoutingAdapter,
} from "./types";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * OSRM public (serveur de démo). Pas de clé. Mondial.
 * Note : OSRM ne sait pas éviter les péages -> `avoidTolls` ignoré.
 */
export const osrmAdapter: RoutingAdapter = {
  id: "osrm",
  requiresKey: false,
  async computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null> {
    // OSRM attend l'ordre lng,lat.
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: opts.signal,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        code?: string;
        routes?: {
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: number[][] };
        }[];
      };
      if (data.code !== "Ok") return null;

      const route = data.routes?.[0];
      const meters = route?.distance;
      const seconds = route?.duration;
      if (
        typeof meters !== "number" ||
        !Number.isFinite(meters) ||
        typeof seconds !== "number"
      ) {
        return null;
      }

      return {
        distanceKm: Math.round((meters / 1000) * 1000) / 1000,
        durationSec: Math.round(seconds),
        geometry: (route?.geometry?.coordinates ?? []) as [number, number][],
      };
    } catch {
      return null;
    }
  },
};

import type {
  LatLng,
  RouteOptions,
  RouteResult,
  RoutingAdapter,
} from "./types";

const IGN_BASE = "https://data.geopf.fr/navigation/itineraire";

/**
 * IGN Géoplateforme (resource `bdtopo-osrm`). No key. France only.
 * Faithful port of the legacy `trajets.calculateRoute` calculation, including
 * the highway-avoidance constraint when péages are excluded.
 */
export const ignAdapter: RoutingAdapter = {
  id: "ign",
  requiresKey: false,
  async computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null> {
    const start = `${from.lng},${from.lat}`;
    const end = `${to.lng},${to.lat}`;

    const constraints = opts.avoidTolls
      ? `&constraints=${encodeURIComponent(
          JSON.stringify({
            constraintType: "banned",
            key: "wayType",
            operator: "=",
            value: "autoroute",
          }),
        )}`
      : "";

    const url = `${IGN_BASE}?resource=bdtopo-osrm&start=${start}&end=${end}&profile=car&optimization=fastest&getSteps=false${constraints}`;

    try {
      const res = await fetch(url, { signal: opts.signal });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        distance?: number;
        duration?: number;
        geometry?: { type?: string; coordinates?: number[][] };
      };

      if (typeof data.distance !== "number" || typeof data.duration !== "number") {
        return null;
      }

      return {
        distanceKm: Math.round((data.distance / 1000) * 1000) / 1000,
        durationSec: Math.round(data.duration),
        geometry: (data.geometry?.coordinates ?? []) as [number, number][],
      };
    } catch {
      return null;
    }
  },
};

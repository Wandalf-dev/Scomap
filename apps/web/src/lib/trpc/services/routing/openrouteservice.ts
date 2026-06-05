import type {
  LatLng,
  RouteOptions,
  RouteResult,
  RoutingAdapter,
} from "./types";

const ORS_BASE = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

/**
 * OpenRouteService. Clé requise (quota gratuit). Mondial.
 * Endpoint GeoJSON : la géométrie est déjà en `[lng, lat]`.
 */
export const orsAdapter: RoutingAdapter = {
  id: "openrouteservice",
  requiresKey: true,
  async computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null> {
    if (!opts.apiKey) return null;

    const body: Record<string, unknown> = {
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    };
    if (opts.avoidTolls) {
      body.options = { avoid_features: ["tollways"] };
    }

    try {
      const res = await fetch(ORS_BASE, {
        method: "POST",
        headers: {
          Authorization: opts.apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        features?: {
          properties?: { summary?: { distance?: number; duration?: number } };
          geometry?: { coordinates?: number[][] };
        }[];
      };

      const feature = data.features?.[0];
      const meters = feature?.properties?.summary?.distance;
      const seconds = feature?.properties?.summary?.duration;
      if (typeof meters !== "number" || typeof seconds !== "number") {
        return null;
      }

      return {
        distanceKm: Math.round((meters / 1000) * 1000) / 1000,
        durationSec: Math.round(seconds),
        geometry: (feature?.geometry?.coordinates ?? []) as [number, number][],
      };
    } catch {
      return null;
    }
  },
};

import { decodePolyline5 } from "./polyline";
import type {
  LatLng,
  RouteOptions,
  RouteResult,
  RoutingAdapter,
} from "./types";

const GOOGLE_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Google Routes API v2. Clé requise (payant au-delà du palier gratuit). Mondial.
 *
 * Contraintes : `X-Goog-FieldMask` obligatoire (jamais `*` qui bascule en SKU
 * Enterprise) ; `routingPreference` omis pour rester sur le SKU Essentials ;
 * `duration` renvoyé sous forme de chaîne ("165s") ; géométrie en polyline
 * précision 5.
 */
export const googleAdapter: RoutingAdapter = {
  id: "google",
  requiresKey: true,
  async computeSegment(
    from: LatLng,
    to: LatLng,
    opts: RouteOptions,
  ): Promise<RouteResult | null> {
    if (!opts.apiKey) return null;

    const body = {
      origin: {
        location: { latLng: { latitude: from.lat, longitude: from.lng } },
      },
      destination: {
        location: { latLng: { latitude: to.lat, longitude: to.lng } },
      },
      travelMode: "DRIVE",
      polylineQuality: "OVERVIEW",
      units: "METRIC",
      languageCode: "fr-FR",
      ...(opts.avoidTolls
        ? { routeModifiers: { avoidTolls: true } }
        : {}),
    };

    try {
      const res = await fetch(GOOGLE_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": opts.apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        routes?: {
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
        }[];
      };

      const route = data.routes?.[0];
      const meters = route?.distanceMeters;
      if (typeof meters !== "number") return null;

      // duration: chaîne "165s"
      const seconds = route?.duration
        ? parseFloat(route.duration.replace(/s$/, ""))
        : NaN;
      if (!Number.isFinite(seconds)) return null;

      const encoded = route?.polyline?.encodedPolyline;
      const geometry = encoded ? decodePolyline5(encoded) : [];

      return {
        distanceKm: Math.round((meters / 1000) * 1000) / 1000,
        durationSec: Math.round(seconds),
        geometry,
      };
    } catch {
      return null;
    }
  },
};

import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../services/routing/resolve";

const pointSchema = z.object({ lat: z.number(), lng: z.number() });

export const routingRouter = createTRPCRouter({
  /**
   * PREVIEW route through already-ORDERED waypoints (the caller provides the
   * order). Read-only: persists nothing — unlike `trajets.calculateRoute` which
   * writes to arrêts/trajet. Reuses the tenant's routing engine (OSRM fallback)
   * and stitches/simplifies the geometry like calculateRoute. Returns `ok:false`
   * (without a misleading partial geometry) if a segment fails.
   */
  previewRoute: tenantProcedure
    .input(
      z.object({
        points: z.array(pointSchema).min(2).max(15),
        avoidTolls: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cfg = await resolveRoutingConfig(ctx.db, ctx.tenantId);

      let totalDistanceKm = 0;
      let totalDurationSec = 0;
      const coords: [number, number][] = [];

      // Sequential (API rate limits), like trajets.calculateRoute.
      for (let i = 1; i < input.points.length; i++) {
        const prev = input.points[i - 1]!;
        const curr = input.points[i]!;
        const outcome = await computeSegmentForTenant(
          { lat: prev.lat, lng: prev.lng },
          { lat: curr.lat, lng: curr.lng },
          cfg,
          input.avoidTolls ?? false,
        );
        if (!outcome.result) {
          return {
            ok: false as const,
            geometry: null,
            distanceKm: null,
            durationSec: null,
          };
        }
        const { distanceKm, durationSec, geometry } = outcome.result;
        totalDistanceKm += distanceKm;
        totalDurationSec += durationSec;
        if (geometry.length > 0) {
          // Avoid duplicating the junction point between segments.
          const startIdx = coords.length > 0 ? 1 : 0;
          for (let j = startIdx; j < geometry.length; j++) coords.push(geometry[j]!);
        }
      }

      // Simplify to ~1000 points for display (same as calculateRoute).
      let simplified = coords;
      if (coords.length > 1000) {
        const step = Math.ceil(coords.length / 1000);
        simplified = coords.filter((_, idx) => idx % step === 0);
        const last = coords[coords.length - 1];
        if (last && simplified[simplified.length - 1] !== last) simplified.push(last);
      }

      return {
        ok: true as const,
        geometry: simplified.length >= 2 ? simplified : null,
        distanceKm: Math.round(totalDistanceKm * 1000) / 1000,
        durationSec: totalDurationSec,
      };
    }),
});

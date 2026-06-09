import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../services/routing/resolve";

const pointSchema = z.object({ lat: z.number(), lng: z.number() });

export const routingRouter = createTRPCRouter({
  /**
   * Itinéraire d'APERÇU à travers des waypoints déjà ORDONNÉS (l'appelant fournit
   * l'ordre). Lecture seule : ne persiste rien — à la différence de
   * `trajets.calculateRoute` qui écrit sur les arrêts/trajet. Réutilise le moteur
   * de routing du tenant (repli OSRM) et stitche/simplifie la géométrie comme
   * calculateRoute. Renvoie `ok:false` (sans géométrie partielle trompeuse) si un
   * segment échoue.
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

      // Séquentiel (limites de débit des APIs), comme trajets.calculateRoute.
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
          // Évite de dupliquer le point de jonction entre segments.
          const startIdx = coords.length > 0 ? 1 : 0;
          for (let j = startIdx; j < geometry.length; j++) coords.push(geometry[j]!);
        }
      }

      // Simplifie à ~1000 points pour l'affichage (idem calculateRoute).
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

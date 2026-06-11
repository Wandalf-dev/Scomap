import { z } from "zod";
import { eq, and, isNull, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { trajets, arrets } from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../../services/routing/resolve";
import type { TRPCRouterRecord } from "@trpc/server";

export const trajetCalculations = {
  calculateRoute: tenantProcedure
    .input(z.object({ trajetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const trajet = await ctx.db
        .select({ id: trajets.id, peages: trajets.peages })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const arretsList = await ctx.db
        .select({
          id: arrets.id,
          latitude: arrets.latitude,
          longitude: arrets.longitude,
          orderIndex: arrets.orderIndex,
        })
        .from(arrets)
        .where(
          and(eq(arrets.trajetId, input.trajetId), isNull(arrets.deletedAt)),
        )
        .orderBy(asc(arrets.orderIndex));

      if (arretsList.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Il faut au moins 2 arrets pour calculer un trajet",
        });
      }

      const hasGps = arretsList.every((a) => a.latitude != null && a.longitude != null);
      if (!hasGps) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tous les arrets doivent avoir des coordonnees GPS",
        });
      }

      let totalDistanceKm = 0;
      let totalDurationSeconds = 0;
      const allCoordinates: number[][] = [];
      const segmentResults: { id: string; distanceKm: number; durationSeconds: number }[] = [];

      const avoidTolls = trajet[0]!.peages === false;

      // Tenant's routing engine, resolved once (key decrypted here).
      const routingConfig = await resolveRoutingConfig(ctx.db, ctx.tenantId);

      // Compute each segment (sequential: API rate limits).
      for (let i = 1; i < arretsList.length; i++) {
        const prev = arretsList[i - 1]!;
        const curr = arretsList[i]!;

        const outcome = await computeSegmentForTenant(
          { lat: prev.latitude!, lng: prev.longitude! },
          { lat: curr.latitude!, lng: curr.longitude! },
          routingConfig,
          avoidTolls,
        );
        if (!outcome.result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Calcul d'itinéraire indisponible pour le segment ${i} (${routingConfig.adapter.id}).`,
          });
        }

        const { distanceKm, durationSec, geometry } = outcome.result;

        totalDistanceKm += distanceKm;
        totalDurationSeconds += durationSec;
        segmentResults.push({ id: curr.id, distanceKm, durationSeconds: durationSec });

        if (geometry.length > 0) {
          const startIdx = allCoordinates.length > 0 ? 1 : 0;
          for (let j = startIdx; j < geometry.length; j++) {
            allCoordinates.push(geometry[j]!);
          }
        }
      }

      // Simplify geometry: keep max ~1000 points for display
      let simplified = allCoordinates;
      if (allCoordinates.length > 1000) {
        const step = Math.ceil(allCoordinates.length / 1000);
        simplified = allCoordinates.filter((_, idx) => idx % step === 0);
        const last = allCoordinates[allCoordinates.length - 1];
        if (last && simplified[simplified.length - 1] !== last) {
          simplified.push(last);
        }
      }

      const routeGeometry = simplified.length >= 2
        ? { type: "LineString" as const, coordinates: simplified }
        : null;

      // Atomic batch update: all DB writes in a single transaction
      await ctx.db.transaction(async (tx) => {
        // First stop has 0 distance
        await tx
          .update(arrets)
          .set({ distanceKm: 0, durationSeconds: 0, updatedAt: new Date() })
          .where(eq(arrets.id, arretsList[0]!.id));

        // Update each segment's stop
        for (const seg of segmentResults) {
          await tx
            .update(arrets)
            .set({
              distanceKm: seg.distanceKm,
              durationSeconds: seg.durationSeconds,
              updatedAt: new Date(),
            })
            .where(eq(arrets.id, seg.id));
        }

        // Update trajet totals + route geometry + etat
        await tx
          .update(trajets)
          .set({
            totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
            totalDurationSeconds: totalDurationSeconds,
            routeGeometry,
            etat: "ok",
            updatedAt: new Date(),
          })
          .where(eq(trajets.id, input.trajetId));
      });

      return { totalDistanceKm, totalDurationSeconds };
    }),

  calculateTimes: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        waitTimeSeconds: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const trajet = await ctx.db
        .select({
          id: trajets.id,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
        })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const t = trajet[0]!;

      const arretsList = await ctx.db
        .select({
          id: arrets.id,
          orderIndex: arrets.orderIndex,
          arrivalTime: arrets.arrivalTime,
          durationSeconds: arrets.durationSeconds,
          timeLocked: arrets.timeLocked,
          waitTime: arrets.waitTime,
        })
        .from(arrets)
        .where(
          and(eq(arrets.trajetId, input.trajetId), isNull(arrets.deletedAt)),
        )
        .orderBy(asc(arrets.orderIndex));

      if (arretsList.length < 2) {
        return { updated: 0 };
      }

      const direction = t.direction; // 'aller' | 'retour'
      const DEFAULT_DEPARTURE_TIME = "08:00";

      // Compute all times in memory first, then batch update in a transaction
      const timeUpdates: { id: string; arrivalTime: string }[] = [];

      if (direction === "aller") {
        // Backwards from last stop (school)
        const lastStop = arretsList[arretsList.length - 1]!;
        let baseTimeSeconds = parseTimeToSeconds(lastStop.arrivalTime || t.departureTime || DEFAULT_DEPARTURE_TIME);

        if (lastStop.timeLocked && lastStop.arrivalTime) {
          baseTimeSeconds = parseTimeToSeconds(lastStop.arrivalTime);
        }

        if (!lastStop.timeLocked) {
          timeUpdates.push({ id: lastStop.id, arrivalTime: secondsToTime(baseTimeSeconds) });
        }

        let cumulSeconds = baseTimeSeconds;

        for (let i = arretsList.length - 2; i >= 0; i--) {
          const stop = arretsList[i]!;
          const nextStop = arretsList[i + 1]!;

          if (stop.timeLocked && stop.arrivalTime) {
            cumulSeconds = parseTimeToSeconds(stop.arrivalTime);
            continue;
          }

          const travelTime = nextStop.durationSeconds ?? 0;
          const waitTimeSec = (stop.waitTime ?? 0) * 60 + input.waitTimeSeconds;
          cumulSeconds = cumulSeconds - travelTime - waitTimeSec;

          timeUpdates.push({ id: stop.id, arrivalTime: secondsToTime(cumulSeconds) });
        }
      } else {
        // Forward from first stop (school)
        const firstStop = arretsList[0]!;
        let baseTimeSeconds = parseTimeToSeconds(firstStop.arrivalTime || t.departureTime || DEFAULT_DEPARTURE_TIME);

        if (firstStop.timeLocked && firstStop.arrivalTime) {
          baseTimeSeconds = parseTimeToSeconds(firstStop.arrivalTime);
        }

        if (!firstStop.timeLocked) {
          timeUpdates.push({ id: firstStop.id, arrivalTime: secondsToTime(baseTimeSeconds) });
        }

        let cumulSeconds = baseTimeSeconds;

        for (let i = 1; i < arretsList.length; i++) {
          const stop = arretsList[i]!;

          if (stop.timeLocked && stop.arrivalTime) {
            cumulSeconds = parseTimeToSeconds(stop.arrivalTime);
            continue;
          }

          const travelTime = stop.durationSeconds ?? 0;
          const prevWaitTimeSec = (arretsList[i - 1]!.waitTime ?? 0) * 60 + input.waitTimeSeconds;
          cumulSeconds = cumulSeconds + travelTime + prevWaitTimeSec;

          timeUpdates.push({ id: stop.id, arrivalTime: secondsToTime(cumulSeconds) });
        }
      }

      // Atomic batch update
      await ctx.db.transaction(async (tx) => {
        for (const u of timeUpdates) {
          await tx
            .update(arrets)
            .set({ arrivalTime: u.arrivalTime, updatedAt: new Date() })
            .where(eq(arrets.id, u.id));
        }
      });

      return { updated: arretsList.length };
    }),
} satisfies TRPCRouterRecord;

function parseTimeToSeconds(time: string): number {
  const parts = time.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  return hours * 3600 + minutes * 60;
}

function secondsToTime(totalSeconds: number): string {
  // Wraparound on 24h for negative values (e.g. -1800 -> 23:30)
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600) % 24;
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

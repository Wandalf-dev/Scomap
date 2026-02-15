import { z } from "zod";
import { eq, and, isNull, gte, lte, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  trajets,
  trajetOccurrences,
  circuits,
  chauffeurs,
  vehicules,
  etablissements,
  arrets,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  trajetSchema,
  trajetDetailSchema,
  occurrenceOverrideSchema,
} from "@/lib/validators/trajet";
import { normalizeDays, isAnyDayActiveForDate, type DayEntry } from "@/lib/types/day-entry";

export const trajetsRouter = createTRPCRouter({
  listByCircuit: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: trajets.id,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          etat: trajets.etat,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeName: vehicules.name,
          createdAt: trajets.createdAt,
        })
        .from(trajets)
        .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
        .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
        .where(
          and(
            eq(trajets.circuitId, input.circuitId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .orderBy(asc(trajets.direction), asc(trajets.name));

      return rows.map((row) => {
        const rec = row.recurrence as { frequency: string; daysOfWeek: unknown } | null;
        return {
          ...row,
          recurrence: rec
            ? { frequency: rec.frequency, daysOfWeek: normalizeDays(rec.daysOfWeek) }
            : null,
        };
      });
    }),

  list: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: trajets.id,
        name: trajets.name,
        direction: trajets.direction,
        departureTime: trajets.departureTime,
        recurrence: trajets.recurrence,
        startDate: trajets.startDate,
        endDate: trajets.endDate,
        etat: trajets.etat,
        totalDistanceKm: trajets.totalDistanceKm,
        circuitId: trajets.circuitId,
        circuitName: circuits.name,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        chauffeurId: trajets.chauffeurId,
        chauffeurFirstName: chauffeurs.firstName,
        chauffeurLastName: chauffeurs.lastName,
        vehiculeId: trajets.vehiculeId,
        vehiculeName: vehicules.name,
        createdAt: trajets.createdAt,
      })
      .from(trajets)
      .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
      .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
      .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
      .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
      .where(
        and(
          eq(trajets.tenantId, ctx.tenantId),
          isNull(trajets.deletedAt),
          eq(circuits.isActive, true),
        ),
      )
      .orderBy(asc(trajets.direction), asc(trajets.name))
      .limit(500);

    return rows.map((row) => {
      const rec = row.recurrence as { frequency: string; daysOfWeek: unknown } | null;
      return {
        ...row,
        recurrence: rec
          ? { frequency: rec.frequency, daysOfWeek: normalizeDays(rec.daysOfWeek) }
          : null,
      };
    });
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: trajets.id,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          notes: trajets.notes,
          etat: trajets.etat,
          peages: trajets.peages,
          kmACharge: trajets.kmACharge,
          totalDistanceKm: trajets.totalDistanceKm,
          totalDurationSeconds: trajets.totalDurationSeconds,
          routeGeometry: trajets.routeGeometry,
          circuitId: trajets.circuitId,
          circuitName: circuits.name,
          circuitStartDate: circuits.startDate,
          circuitEndDate: circuits.endDate,
          circuitIsActive: circuits.isActive,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          chauffeurId: trajets.chauffeurId,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeId: trajets.vehiculeId,
          vehiculeName: vehicules.name,
          vehiculeLicensePlate: vehicules.licensePlate,
          createdAt: trajets.createdAt,
          updatedAt: trajets.updatedAt,
        })
        .from(trajets)
        .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
        .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
        .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
        .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      const row = result[0];
      if (!row) return null;

      // Compute effective state
      let effectiveEtat: string;
      if (row.circuitIsActive === false) {
        effectiveEtat = "suspendu";
      } else if (row.routeGeometry && row.totalDistanceKm) {
        effectiveEtat = "ok";
      } else {
        effectiveEtat = "brouillon";
      }

      // Effective dates/days (trajet override or circuit fallback)
      const recurrence = row.recurrence as { frequency: string; daysOfWeek: unknown } | null;
      const normalizedRecDays = normalizeDays(recurrence?.daysOfWeek);
      const effectiveStartDate = row.startDate ?? row.circuitStartDate ?? null;
      const effectiveEndDate = row.endDate ?? row.circuitEndDate ?? null;
      const effectiveDaysOfWeek = normalizedRecDays;

      return {
        ...row,
        effectiveEtat,
        effectiveStartDate,
        effectiveEndDate,
        effectiveDaysOfWeek,
      };
    }),

  create: tenantProcedure
    .input(trajetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          circuitId: input.circuitId,
          direction: input.direction,
        })
        .returning();

      const created = result[0];
      if (created) {
        await autoCreateEtablissementArret(ctx, created.id, input.circuitId);
      }

      return created;
    }),

  createFull: tenantProcedure
    .input(trajetDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          circuitId: input.circuitId,
          direction: input.direction,
          chauffeurId: input.chauffeurId ?? null,
          vehiculeId: input.vehiculeId ?? null,
          departureTime: input.departureTime || null,
          recurrence: input.recurrence ?? null,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          notes: input.notes || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de la creation",
        });
      }

      await autoCreateEtablissementArret(ctx, created.id, input.circuitId);

      return created;
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: trajetSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({
          name: input.data.name,
          circuitId: input.data.circuitId,
          direction: input.data.direction,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: trajetDetailSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({
          name: input.data.name,
          circuitId: input.data.circuitId,
          direction: input.data.direction,
          chauffeurId: input.data.chauffeurId ?? null,
          vehiculeId: input.data.vehiculeId ?? null,
          departureTime: input.data.departureTime || null,
          recurrence: input.data.recurrence ?? null,
          startDate: input.data.startDate || null,
          endDate: input.data.endDate || null,
          notes: input.data.notes || null,
          peages: input.data.peages ?? false,
          kmACharge: input.data.kmACharge ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  // --- Calculs ---

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
      const constraintsObj = { constraintType: "banned", key: "wayType", operator: "=", value: "autoroute" };
      const constraints = avoidTolls
        ? `&constraints=${encodeURIComponent(JSON.stringify(constraintsObj))}`
        : "";

      // Fetch all segments from IGN API (sequential due to rate limits)
      for (let i = 1; i < arretsList.length; i++) {
        const prev = arretsList[i - 1]!;
        const curr = arretsList[i]!;

        const start = `${prev.longitude},${prev.latitude}`;
        const end = `${curr.longitude},${curr.latitude}`;

        const url = `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&start=${start}&end=${end}&profile=car&optimization=fastest&getSteps=false${constraints}`;

        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erreur API IGN pour le segment ${i} (HTTP ${response.status})`,
          });
        }

        const data = (await response.json()) as {
          distance: number;
          duration: number;
          geometry?: { type: string; coordinates: number[][] };
        };

        const distanceKm = Math.round((data.distance / 1000) * 1000) / 1000;
        const durationSec = Math.round(data.duration);

        totalDistanceKm += distanceKm;
        totalDurationSeconds += durationSec;
        segmentResults.push({ id: curr.id, distanceKm, durationSeconds: durationSec });

        if (data.geometry?.coordinates) {
          const coords = data.geometry.coordinates;
          const startIdx = allCoordinates.length > 0 ? 1 : 0;
          for (let j = startIdx; j < coords.length; j++) {
            allCoordinates.push(coords[j]!);
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

  // --- Occurrences ---

  generateOccurrences: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        fromDate: z.string(),
        toDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the trajet with circuit fallback data
      const trajet = await ctx.db
        .select({
          id: trajets.id,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          recurrence: trajets.recurrence,
          circuitStartDate: circuits.startDate,
          circuitEndDate: circuits.endDate,
        })
        .from(trajets)
        .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      const t = trajet[0];
      if (!t) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      // Effective days: trajet override or circuit fallback
      const recurrence = t.recurrence as {
        frequency: string;
        daysOfWeek: unknown;
      } | null;
      const normalizedRecDays = normalizeDays(recurrence?.daysOfWeek);
      const effectiveDays: DayEntry[] = normalizedRecDays;

      if (effectiveDays.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce trajet n'a pas de recurrence configuree",
        });
      }

      // Effective dates: trajet override or circuit fallback
      const effectiveStartDate = t.startDate ?? t.circuitStartDate ?? null;
      const effectiveEndDate = t.endDate ?? t.circuitEndDate ?? null;

      // Calculate dates
      const startMs = effectiveStartDate
        ? Math.max(new Date(input.fromDate).getTime(), new Date(effectiveStartDate).getTime())
        : new Date(input.fromDate).getTime();
      const start = new Date(startMs);
      const end = effectiveEndDate
        ? new Date(Math.min(new Date(input.toDate).getTime(), new Date(effectiveEndDate).getTime()))
        : new Date(input.toDate);

      const dates: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        if (isAnyDayActiveForDate(effectiveDays, current)) {
          dates.push(current.toISOString().split("T")[0]!);
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length === 0) {
        return { inserted: 0 };
      }

      // Bulk insert with ON CONFLICT DO NOTHING
      const values = dates.map((d) => ({
        tenantId: ctx.tenantId,
        trajetId: input.trajetId,
        date: d,
        status: "planifie" as const,
      }));

      const result = await ctx.db
        .insert(trajetOccurrences)
        .values(values)
        .onConflictDoNothing({
          target: [trajetOccurrences.trajetId, trajetOccurrences.date],
        })
        .returning();

      return { inserted: result.length };
    }),

  listOccurrences: tenantProcedure
    .input(
      z.object({
        fromDate: z.string(),
        toDate: z.string(),
        trajetId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(trajetOccurrences.tenantId, ctx.tenantId),
        gte(trajetOccurrences.date, input.fromDate),
        lte(trajetOccurrences.date, input.toDate),
      ];

      if (input.trajetId) {
        conditions.push(eq(trajetOccurrences.trajetId, input.trajetId));
      }

      return ctx.db
        .select({
          id: trajetOccurrences.id,
          trajetId: trajetOccurrences.trajetId,
          date: trajetOccurrences.date,
          status: trajetOccurrences.status,
          overrideChauffeurId: trajetOccurrences.chauffeurId,
          overrideVehiculeId: trajetOccurrences.vehiculeId,
          overrideDepartureTime: trajetOccurrences.departureTime,
          overrideNotes: trajetOccurrences.notes,
          // Trajet parent info
          trajetName: trajets.name,
          trajetDirection: trajets.direction,
          trajetDepartureTime: trajets.departureTime,
          trajetChauffeurId: trajets.chauffeurId,
          trajetVehiculeId: trajets.vehiculeId,
          // Joined info
          circuitName: circuits.name,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeName: vehicules.name,
        })
        .from(trajetOccurrences)
        .innerJoin(trajets, eq(trajetOccurrences.trajetId, trajets.id))
        .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
        .leftJoin(
          chauffeurs,
          eq(
            sql`COALESCE(${trajetOccurrences.chauffeurId}, ${trajets.chauffeurId})`,
            chauffeurs.id,
          ),
        )
        .leftJoin(
          vehicules,
          eq(
            sql`COALESCE(${trajetOccurrences.vehiculeId}, ${trajets.vehiculeId})`,
            vehicules.id,
          ),
        )
        .where(and(...conditions))
        .limit(1000);
    }),

  updateOccurrence: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: occurrenceOverrideSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajetOccurrences)
        .set({
          chauffeurId: input.data.chauffeurId,
          vehiculeId: input.data.vehiculeId,
          departureTime: input.data.departureTime,
          status: input.data.status,
          notes: input.data.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrences.id, input.id),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  cancelOccurrence: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajetOccurrences)
        .set({
          status: "annule",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrences.id, input.id),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

// Helper: auto-create an "etablissement" stop when creating a trajet
async function autoCreateEtablissementArret(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  trajetId: string,
  circuitId: string,
) {
  // Fetch the circuit's etablissement
  const circuit = await ctx.db
    .select({
      etablissementId: circuits.etablissementId,
      etablissementName: etablissements.name,
      etablissementAddress: etablissements.address,
      etablissementCity: etablissements.city,
      etablissementPostalCode: etablissements.postalCode,
      etablissementLatitude: etablissements.latitude,
      etablissementLongitude: etablissements.longitude,
    })
    .from(circuits)
    .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
    .where(eq(circuits.id, circuitId))
    .limit(1);

  const c = circuit[0];
  if (!c?.etablissementId) return;

  await ctx.db.insert(arrets).values({
    tenantId: ctx.tenantId,
    trajetId,
    type: "etablissement",
    etablissementId: c.etablissementId,
    name: c.etablissementName ?? "Etablissement",
    address: [c.etablissementAddress, c.etablissementPostalCode, c.etablissementCity]
      .filter(Boolean)
      .join(", "),
    latitude: c.etablissementLatitude ?? null,
    longitude: c.etablissementLongitude ?? null,
    orderIndex: 0,
  });
}

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

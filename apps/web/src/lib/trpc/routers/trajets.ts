import { z } from "zod";
import { eq, and, isNull, inArray, gte, lte, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  trajets,
  trajetOccurrences,
  circuits,
  chauffeurs,
  vehicules,
  etablissements,
  arrets,
  avenants,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { assertTenantOwned } from "../ownership";
import {
  trajetSchema,
  trajetDetailSchema,
  occurrenceOverrideSchema,
} from "@/lib/validators/trajet";
import { normalizeDays, isAnyDayActiveForDate, type DayEntry } from "@/lib/types/day-entry";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../services/routing/resolve";
import { buildTrajetName } from "../services/trajet-sync";
import { nextDisplayId } from "@/lib/db/display-id";

export const trajetsRouter = createTRPCRouter({
  listByCircuit: tenantProcedure
    .input(
      z.object({
        circuitId: z.string().uuid(),
        // Date de résolution (défaut : aujourd'hui). Fournir une date d'avenant
        // fige l'état du circuit tel qu'il est à cette date (vue « à la date de
        // l'avenant ») : validité/compteurs des trajets résolus à cette date.
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // NB : nommé `today` mais = date de référence (peut être une date passée).
      const today = input.date ?? new Date().toISOString().slice(0, 10);
      // Agrégats temporels par trajet (présence des usagers, résolue par date)
      // pour distinguer trajets actifs / à venir / terminés après un avenant.
      const usagerArretCond = sql`a.type = 'usager' and a.deleted_at is null`;
      const rows = await ctx.db
        .select({
          id: trajets.id,
          displayId: trajets.displayId,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          etat: trajets.etat,
          circuitCode: circuits.code,
          notes: trajets.notes,
          circuitName: circuits.name,
          circuitStartDate: circuits.startDate,
          createdByAvenantId: trajets.createdByAvenantId,
          avenantDisplayId: avenants.displayId,
          avenantEffectiveDate: avenants.effectiveDate,
          etablissementCount: sql<number>`(select count(distinct a.etablissement_id) from ${arrets} a where a.trajet_id = ${trajets.id} and a.type = 'etablissement' and a.deleted_at is null)::int`,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeName: vehicules.name,
          createdAt: trajets.createdAt,
          activeCount: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and ${usagerArretCond} and (a.valid_from is null or a.valid_from <= ${today}) and (a.valid_to is null or a.valid_to >= ${today}))::int`,
          futureCount: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and ${usagerArretCond} and a.valid_from > ${today})::int`,
          totalUsager: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and ${usagerArretCond})::int`,
          firstStart: sql<string | null>`(select min(a.valid_from) from ${arrets} a where a.trajet_id = ${trajets.id} and ${usagerArretCond})`,
          lastEnd: sql<string | null>`(select max(a.valid_to) from ${arrets} a where a.trajet_id = ${trajets.id} and ${usagerArretCond})`,
          totalDistanceKm: trajets.totalDistanceKm,
          totalDurationSeconds: trajets.totalDurationSeconds,
          // Pour l'état « horaires calculés » : arrêts actifs vs arrêts sans heure.
          arretsActive: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and a.deleted_at is null and (a.valid_from is null or a.valid_from <= ${today}) and (a.valid_to is null or a.valid_to >= ${today}))::int`,
          arretsUntimed: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and a.deleted_at is null and a.arrival_time is null and (a.valid_from is null or a.valid_from <= ${today}) and (a.valid_to is null or a.valid_to >= ${today}))::int`,
        })
        .from(trajets)
        // Re-filtre tenant sur les jointures (anti-IDOR via FK injectée)
        .leftJoin(
          chauffeurs,
          and(eq(trajets.chauffeurId, chauffeurs.id), eq(chauffeurs.tenantId, ctx.tenantId)),
        )
        .leftJoin(
          vehicules,
          and(eq(trajets.vehiculeId, vehicules.id), eq(vehicules.tenantId, ctx.tenantId)),
        )
        .leftJoin(
          circuits,
          and(eq(trajets.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
        )
        .leftJoin(
          avenants,
          and(eq(trajets.createdByAvenantId, avenants.id), eq(avenants.tenantId, ctx.tenantId)),
        )
        .where(
          and(
            eq(trajets.circuitId, input.circuitId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .orderBy(asc(trajets.direction), asc(trajets.name));

      type Validity = {
        status: "actif" | "avenir" | "termine" | "vide";
        date: string | null;
      };
      const PRIORITY = { actif: 0, avenir: 1, vide: 2, termine: 3 };

      const mapped = rows.map((row) => {
        const rec = row.recurrence as { frequency: string; daysOfWeek: unknown } | null;
        const normDays = rec ? normalizeDays(rec.daysOfWeek) : [];
        let validity: Validity;
        if (row.activeCount > 0) validity = { status: "actif", date: null };
        else if (row.futureCount > 0)
          validity = { status: "avenir", date: row.firstStart };
        else if (row.totalUsager > 0)
          validity = { status: "termine", date: row.lastEnd };
        else validity = { status: "vide", date: null };
        return {
          ...row,
          name: normDays.length
            ? buildTrajetName(row.direction, normDays)
            : row.name,
          recurrence: rec ? { frequency: rec.frequency, daysOfWeek: normDays } : null,
          validity,
        };
      });

      // Actifs d'abord, terminés en dernier (puis direction/nom).
      return mapped.sort(
        (a, b) =>
          PRIORITY[a.validity.status] - PRIORITY[b.validity.status] ||
          a.direction.localeCompare(b.direction) ||
          a.name.localeCompare(b.name),
      );
    }),

  list: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: trajets.id,
        displayId: trajets.displayId,
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
      // Re-filtre tenant sur les jointures (anti-IDOR via FK injectée)
      .leftJoin(
        circuits,
        and(eq(trajets.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
      )
      .leftJoin(
        etablissements,
        and(
          eq(circuits.etablissementId, etablissements.id),
          eq(etablissements.tenantId, ctx.tenantId),
        ),
      )
      .leftJoin(
        chauffeurs,
        and(eq(trajets.chauffeurId, chauffeurs.id), eq(chauffeurs.tenantId, ctx.tenantId)),
      )
      .leftJoin(
        vehicules,
        and(eq(trajets.vehiculeId, vehicules.id), eq(vehicules.tenantId, ctx.tenantId)),
      )
      .where(
        and(
          eq(trajets.tenantId, ctx.tenantId),
          isNull(trajets.deletedAt),
          isNull(trajets.preparationCampaignId),
          isNull(circuits.archivedAt),
        ),
      )
      .orderBy(asc(trajets.direction), asc(trajets.name))
      .limit(500);

    return rows.map((row) => {
      const rec = row.recurrence as { frequency: string; daysOfWeek: unknown } | null;
      const normDays = rec ? normalizeDays(rec.daysOfWeek) : [];
      return {
        ...row,
        name: normDays.length ? buildTrajetName(row.direction, normDays) : row.name,
        recurrence: rec ? { frequency: rec.frequency, daysOfWeek: normDays } : null,
      };
    });
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: trajets.id,
          displayId: trajets.displayId,
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
          circuitArchivedAt: circuits.archivedAt,
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
        // Re-filtre tenant sur les jointures (anti-IDOR via FK injectée)
        .leftJoin(
          circuits,
          and(eq(trajets.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
        )
        .leftJoin(
          etablissements,
          and(
            eq(circuits.etablissementId, etablissements.id),
            eq(etablissements.tenantId, ctx.tenantId),
          ),
        )
        .leftJoin(
          chauffeurs,
          and(eq(trajets.chauffeurId, chauffeurs.id), eq(chauffeurs.tenantId, ctx.tenantId)),
        )
        .leftJoin(
          vehicules,
          and(eq(trajets.vehiculeId, vehicules.id), eq(vehicules.tenantId, ctx.tenantId)),
        )
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
      if (row.circuitArchivedAt != null) {
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
        name: normalizedRecDays.length
          ? buildTrajetName(row.direction, normalizedRecDays)
          : row.name,
        effectiveEtat,
        effectiveStartDate,
        effectiveEndDate,
        effectiveDaysOfWeek,
      };
    }),

  create: tenantProcedure
    .input(trajetSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCircuitOwned(ctx, input.circuitId);
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "trajets");
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          displayId,
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
      await assertCircuitOwned(ctx, input.circuitId);
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "trajets");
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          displayId,
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
      await assertCircuitOwned(ctx, input.data.circuitId);
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
      await Promise.all([
        assertCircuitOwned(ctx, input.data.circuitId),
        input.data.chauffeurId
          ? assertTenantOwned(ctx.db, chauffeurs, input.data.chauffeurId, ctx.tenantId, "Chauffeur")
          : null,
        input.data.vehiculeId
          ? assertTenantOwned(ctx.db, vehicules, input.data.vehiculeId, ctx.tenantId, "Vehicule")
          : null,
      ]);
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

  deleteMany: tenantProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { deleted: 0 };

      const result = await ctx.db
        .update(trajets)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(trajets.tenantId, ctx.tenantId),
            inArray(trajets.id, input.ids),
            isNull(trajets.deletedAt),
          ),
        )
        .returning({ id: trajets.id });

      return { deleted: result.length };
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

      // Moteur de routing du tenant, résolu une seule fois (clé déchiffrée ici).
      const routingConfig = await resolveRoutingConfig(ctx.db, ctx.tenantId);

      // Calcul de chaque segment (séquentiel : limites de débit des APIs).
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

  // --- Occurrences ---

  /**
   * Occurrences DÉRIVÉES à la volée des trajets (récurrence × fenêtre de
   * validité, repli sur les dates du circuit) : le planning reflète toujours
   * l'état réel des circuits/trajets, sans étape de génération. La table
   * trajet_occurrences ne stocke que les EXCEPTIONS (personnalisations,
   * statuts), superposées ici aux dates calculées. Une exception
   * personnalisée dont le jour est sorti de la récurrence (ex. avenant)
   * reste affichée tant qu'elle est dans la fenêtre du trajet.
   */
  listOccurrences: tenantProcedure
    .input(
      z.object({
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        trajetId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rangeDays = Math.round(
        (new Date(input.toDate).getTime() - new Date(input.fromDate).getTime()) /
          86400000,
      );
      // 400 jours : couvre une année scolaire complète (fiche trajet).
      if (Number.isNaN(rangeDays) || rangeDays < 0 || rangeDays > 400) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Plage de dates invalide (400 jours maximum)",
        });
      }

      const trajetConditions = [
        eq(trajets.tenantId, ctx.tenantId),
        isNull(trajets.deletedAt),
      ];
      if (input.trajetId) {
        trajetConditions.push(eq(trajets.id, input.trajetId));
      }

      const activeTrajets = await ctx.db
        .select({
          id: trajets.id,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          chauffeurId: trajets.chauffeurId,
          vehiculeId: trajets.vehiculeId,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          circuitName: circuits.name,
          circuitStartDate: circuits.startDate,
          circuitEndDate: circuits.endDate,
        })
        .from(trajets)
        .leftJoin(
          circuits,
          and(eq(trajets.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
        )
        .where(and(...trajetConditions));

      // Exceptions stockées (personnalisations / statuts) sur la plage.
      const trajetIds = activeTrajets.map((t) => t.id);
      const exceptionRows =
        trajetIds.length > 0
          ? await ctx.db
              .select()
              .from(trajetOccurrences)
              .where(
                and(
                  eq(trajetOccurrences.tenantId, ctx.tenantId),
                  inArray(trajetOccurrences.trajetId, trajetIds),
                  gte(trajetOccurrences.date, input.fromDate),
                  lte(trajetOccurrences.date, input.toDate),
                ),
              )
          : [];
      const exceptionByKey = new Map(
        exceptionRows.map((r) => [`${r.trajetId}|${r.date}`, r]),
      );

      type ExceptionRow = (typeof exceptionRows)[number];
      type ActiveTrajet = (typeof activeTrajets)[number];

      const items: {
        id: string | null;
        trajetId: string;
        date: string;
        status: string;
        overrideChauffeurId: string | null;
        overrideVehiculeId: string | null;
        overrideDepartureTime: string | null;
        overrideNotes: string | null;
        trajetName: string;
        trajetDirection: string;
        trajetDepartureTime: string | null;
        trajetChauffeurId: string | null;
        trajetVehiculeId: string | null;
        circuitName: string | null;
      }[] = [];

      const pushItem = (
        t: ActiveTrajet,
        date: string,
        ex: ExceptionRow | undefined,
      ) => {
        items.push({
          id: ex?.id ?? null,
          trajetId: t.id,
          date,
          status: ex?.status ?? "planifie",
          overrideChauffeurId: ex?.chauffeurId ?? null,
          overrideVehiculeId: ex?.vehiculeId ?? null,
          overrideDepartureTime: ex?.departureTime ?? null,
          overrideNotes: ex?.notes ?? null,
          trajetName: t.name,
          trajetDirection: t.direction,
          trajetDepartureTime: t.departureTime,
          trajetChauffeurId: t.chauffeurId,
          trajetVehiculeId: t.vehiculeId,
          circuitName: t.circuitName,
        });
      };

      for (const t of activeTrajets) {
        const recDays = normalizeDays(
          (t.recurrence as { daysOfWeek?: unknown } | null)?.daysOfWeek as
            | DayEntry[]
            | null
            | undefined,
        );
        const windowStart = t.startDate ?? t.circuitStartDate ?? null;
        const windowEnd = t.endDate ?? t.circuitEndDate ?? null;
        const inWindow = (d: string) =>
          (!windowStart || windowStart <= d) && (!windowEnd || windowEnd >= d);

        const derivedDates = new Set<string>();
        if (recDays.length > 0) {
          const current = new Date(input.fromDate);
          const end = new Date(input.toDate);
          while (current <= end) {
            const dateStr = current.toISOString().split("T")[0]!;
            if (inWindow(dateStr) && isAnyDayActiveForDate(recDays, current)) {
              derivedDates.add(dateStr);
              pushItem(t, dateStr, exceptionByKey.get(`${t.id}|${dateStr}`));
            }
            current.setDate(current.getDate() + 1);
          }
        }

        for (const r of exceptionRows) {
          if (r.trajetId !== t.id || derivedDates.has(r.date)) continue;
          const personalized =
            r.chauffeurId != null ||
            r.vehiculeId != null ||
            r.departureTime != null ||
            r.notes != null ||
            r.status !== "planifie";
          if (personalized && inWindow(r.date)) pushItem(t, r.date, r);
        }
      }

      // Résolution des noms chauffeur/véhicule (override prioritaire).
      const chauffeurIds = new Set<string>();
      const vehiculeIds = new Set<string>();
      for (const it of items) {
        const c = it.overrideChauffeurId ?? it.trajetChauffeurId;
        if (c) chauffeurIds.add(c);
        const v = it.overrideVehiculeId ?? it.trajetVehiculeId;
        if (v) vehiculeIds.add(v);
      }
      const chauffeurRows =
        chauffeurIds.size > 0
          ? await ctx.db
              .select({
                id: chauffeurs.id,
                firstName: chauffeurs.firstName,
                lastName: chauffeurs.lastName,
              })
              .from(chauffeurs)
              .where(
                and(
                  eq(chauffeurs.tenantId, ctx.tenantId),
                  inArray(chauffeurs.id, [...chauffeurIds]),
                ),
              )
          : [];
      const vehiculeRows =
        vehiculeIds.size > 0
          ? await ctx.db
              .select({ id: vehicules.id, name: vehicules.name })
              .from(vehicules)
              .where(
                and(
                  eq(vehicules.tenantId, ctx.tenantId),
                  inArray(vehicules.id, [...vehiculeIds]),
                ),
              )
          : [];
      const chauffeurById = new Map(chauffeurRows.map((c) => [c.id, c]));
      const vehiculeById = new Map(vehiculeRows.map((v) => [v.id, v]));

      return items
        .map((it) => {
          const c = chauffeurById.get(
            it.overrideChauffeurId ?? it.trajetChauffeurId ?? "",
          );
          const v = vehiculeById.get(
            it.overrideVehiculeId ?? it.trajetVehiculeId ?? "",
          );
          return {
            ...it,
            chauffeurFirstName: c?.firstName ?? null,
            chauffeurLastName: c?.lastName ?? null,
            vehiculeName: v?.name ?? null,
          };
        })
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            (a.overrideDepartureTime ?? a.trajetDepartureTime ?? "99:99").localeCompare(
              b.overrideDepartureTime ?? b.trajetDepartureTime ?? "99:99",
            ),
        );
    }),

  /**
   * Personnalise une occurrence, identifiée par (trajet, date) puisque les
   * occurrences sont dérivées : la ligne d'exception est créée à la première
   * personnalisation (upsert), puis mise à jour.
   */
  updateOccurrence: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        data: occurrenceOverrideSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet"),
        input.data.chauffeurId
          ? assertTenantOwned(ctx.db, chauffeurs, input.data.chauffeurId, ctx.tenantId, "Chauffeur")
          : null,
        input.data.vehiculeId
          ? assertTenantOwned(ctx.db, vehicules, input.data.vehiculeId, ctx.tenantId, "Vehicule")
          : null,
      ]);

      // En cas de mise à jour, seuls les champs réellement fournis écrasent
      // l'existant (un champ absent du payload reste intact).
      const updateSet = {
        ...(input.data.status !== undefined ? { status: input.data.status } : {}),
        ...(input.data.chauffeurId !== undefined
          ? { chauffeurId: input.data.chauffeurId }
          : {}),
        ...(input.data.vehiculeId !== undefined
          ? { vehiculeId: input.data.vehiculeId }
          : {}),
        ...(input.data.departureTime !== undefined
          ? { departureTime: input.data.departureTime }
          : {}),
        ...(input.data.notes !== undefined ? { notes: input.data.notes } : {}),
        updatedAt: new Date(),
      };

      const result = await ctx.db
        .insert(trajetOccurrences)
        .values({
          tenantId: ctx.tenantId,
          trajetId: input.trajetId,
          date: input.date,
          status: input.data.status ?? "planifie",
          chauffeurId: input.data.chauffeurId ?? null,
          vehiculeId: input.data.vehiculeId ?? null,
          departureTime: input.data.departureTime ?? null,
          notes: input.data.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [trajetOccurrences.trajetId, trajetOccurrences.date],
          set: updateSet,
        })
        .returning();

      return result[0] ?? null;
    }),

  cancelOccurrence: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");
      const result = await ctx.db
        .insert(trajetOccurrences)
        .values({
          tenantId: ctx.tenantId,
          trajetId: input.trajetId,
          date: input.date,
          status: "annule",
        })
        .onConflictDoUpdate({
          target: [trajetOccurrences.trajetId, trajetOccurrences.date],
          set: { status: "annule", updatedAt: new Date() },
        })
        .returning();

      return result[0] ?? null;
    }),
});

// Garde anti-IDOR : vérifie qu'un circuitId fourni en input appartient bien au tenant
async function assertCircuitOwned(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  circuitId: string,
) {
  await assertTenantOwned(ctx.db, circuits, circuitId, ctx.tenantId, "Circuit");
}

// Helper: auto-create an "etablissement" stop when creating a trajet
async function autoCreateEtablissementArret(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  trajetId: string,
  circuitId: string,
) {
  // Fetch the circuit's etablissement — filtre tenant sur le circuit ET la
  // jointure : sans lui, un circuitId d'un autre tenant exfiltrerait
  // l'adresse de son établissement (IDOR cross-tenant)
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
    .leftJoin(
      etablissements,
      and(
        eq(circuits.etablissementId, etablissements.id),
        eq(etablissements.tenantId, ctx.tenantId),
      ),
    )
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
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

import { z } from "zod";
import { eq, and, or, isNull, inArray, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  trajets,
  trajetOccurrences,
  trajetOccurrenceArrets,
  circuits,
  chauffeurs,
  vehicules,
  usagers,
  usagerAddresses,
  etablissements,
} from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { assertTenantOwned } from "../../ownership";
import { resolveArretsForDate } from "../../services/arrets-for-date";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../../services/routing/resolve";
import {
  occurrenceOverrideSchema,
  occurrenceArretAddSchema,
} from "@/lib/validators/trajet";
import { normalizeDays, isAnyDayActiveForDate, type DayEntry } from "@/lib/types/day-entry";
import type { TRPCRouterRecord } from "@trpc/server";

const occurrenceKeySchema = z.object({
  trajetId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const occurrenceProcedures = {
  /**
   * Occurrences DERIVED on the fly from trajets (recurrence × validity
   * window, falling back to the circuit dates): the planning always reflects
   * the real state of circuits/trajets, with no generation step. The
   * trajet_occurrences table only stores EXCEPTIONS (personalizations,
   * statuses), overlaid here on the computed dates. A personalized exception
   * whose day dropped out of the recurrence (e.g. avenant) stays displayed
   * as long as it is within the trajet's window.
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
      // 400 days: covers a full school year (trajet fiche).
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
          totalDurationSeconds: trajets.totalDurationSeconds,
          circuitId: trajets.circuitId,
          circuitName: circuits.name,
          circuitStartDate: circuits.startDate,
          circuitEndDate: circuits.endDate,
          etablissementId: circuits.etablissementId,
        })
        .from(trajets)
        .leftJoin(
          circuits,
          and(eq(trajets.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
        )
        .where(and(...trajetConditions));

      // Stored exceptions (personalizations / statuses) over the range.
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
        trajetDurationSeconds: number | null;
        circuitId: string;
        circuitName: string | null;
        etablissementId: string | null;
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
          trajetDurationSeconds: t.totalDurationSeconds,
          circuitId: t.circuitId,
          circuitName: t.circuitName,
          etablissementId: t.etablissementId,
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

      // Resolve chauffeur/vehicule names (override takes precedence).
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
   * Personalizes an occurrence, identified by (trajet, date) since
   * occurrences are derived: the exception row is created on the first
   * personalization (upsert), then updated.
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

      // On update, only the fields actually provided overwrite the existing
      // values (a field absent from the payload stays intact).
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

  /**
   * Stops of the occurrence (fiche trajet du jour). Until the day is
   * customized, the base arrêts resolved at the date are returned as-is
   * (with the trajet's route). On first customization they are MATERIALIZED
   * into trajet_occurrence_arrets so the day's composition can be reordered,
   * re-timed and routed independently.
   */
  listOccurrenceArrets: tenantProcedure
    .input(occurrenceKeySchema)
    .query(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");

      const materialized = await loadMaterializedStops(ctx.db, ctx.tenantId, input.trajetId, input.date);

      if (materialized.length > 0) {
        const occ = await ctx.db
          .select({
            totalDistanceKm: trajetOccurrences.totalDistanceKm,
            totalDurationSeconds: trajetOccurrences.totalDurationSeconds,
            routeGeometry: trajetOccurrences.routeGeometry,
          })
          .from(trajetOccurrences)
          .where(
            and(
              eq(trajetOccurrences.trajetId, input.trajetId),
              eq(trajetOccurrences.date, input.date),
              eq(trajetOccurrences.tenantId, ctx.tenantId),
            ),
          )
          .limit(1);
        return {
          materialized: true,
          stops: materialized,
          totalDistanceKm: occ[0]?.totalDistanceKm ?? null,
          totalDurationSeconds: occ[0]?.totalDurationSeconds ?? null,
          routeGeometry: occ[0]?.routeGeometry ?? null,
        };
      }

      // Derived: base composition + the trajet's own route.
      const [baseStops, trajetRow] = await Promise.all([
        resolveArretsForDate(ctx.db, ctx.tenantId, input.trajetId, input.date),
        ctx.db
          .select({
            totalDistanceKm: trajets.totalDistanceKm,
            totalDurationSeconds: trajets.totalDurationSeconds,
            routeGeometry: trajets.routeGeometry,
          })
          .from(trajets)
          .where(eq(trajets.id, input.trajetId))
          .limit(1),
      ]);

      return {
        materialized: false,
        stops: baseStops.map((s, i) => ({
          id: s.id,
          source: "base" as const,
          type: s.type,
          usagerAddressId: s.usagerAddressId,
          etablissementId: s.etablissementId,
          name: s.name,
          address: s.address,
          latitude: s.latitude,
          longitude: s.longitude,
          orderIndex: i,
          arrivalTime: s.arrivalTime,
          waitTime: s.waitTime,
          distanceKm: s.distanceKm,
          durationSeconds: s.durationSeconds,
          timeLocked: s.timeLocked,
          usagerId: s.usagerId,
        })),
        totalDistanceKm: trajetRow[0]?.totalDistanceKm ?? null,
        totalDurationSeconds: trajetRow[0]?.totalDurationSeconds ?? null,
        routeGeometry: trajetRow[0]?.routeGeometry ?? null,
      };
    }),

  /** Adds a one-off stop to the occurrence (usager / établissement / point libre). */
  addOccurrenceArret: tenantProcedure
    .input(occurrenceKeySchema.extend({ data: occurrenceArretAddSchema }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet"),
        input.data.usagerAddressId
          ? assertTenantOwned(ctx.db, usagerAddresses, input.data.usagerAddressId, ctx.tenantId, "Adresse")
          : null,
        input.data.etablissementId
          ? assertTenantOwned(ctx.db, etablissements, input.data.etablissementId, ctx.tenantId, "Etablissement")
          : null,
      ]);

      const rows = await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      const nextOrder = rows.reduce((m, r) => Math.max(m, r.orderIndex), -1) + 1;

      const result = await ctx.db
        .insert(trajetOccurrenceArrets)
        .values({
          tenantId: ctx.tenantId,
          trajetId: input.trajetId,
          date: input.date,
          kind: "add",
          type: input.data.type,
          usagerAddressId: input.data.usagerAddressId ?? null,
          etablissementId: input.data.etablissementId ?? null,
          name: input.data.name,
          address: input.data.address ?? null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          arrivalTime: input.data.arrivalTime ?? null,
          orderIndex: nextOrder,
        })
        .returning();

      return result[0] ?? null;
    }),

  /** Removes a stop from the day (base stops are removable: day-scoped copy). */
  removeOccurrenceArret: tenantProcedure
    .input(occurrenceKeySchema.extend({ stopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");
      await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      // stopId may be either the materialized row id or — right after
      // materialization — the base arrêt id shown before it.
      const result = await ctx.db
        .delete(trajetOccurrenceArrets)
        .where(
          and(
            eq(trajetOccurrenceArrets.tenantId, ctx.tenantId),
            eq(trajetOccurrenceArrets.trajetId, input.trajetId),
            eq(trajetOccurrenceArrets.date, input.date),
            or(
              eq(trajetOccurrenceArrets.id, input.stopId),
              eq(trajetOccurrenceArrets.baseArretId, input.stopId),
            ),
          ),
        )
        .returning({ id: trajetOccurrenceArrets.id });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arrêt non trouvé" });
      }
      return result[0];
    }),

  /** Reorders the day's stops (drag & drop). */
  reorderOccurrenceArrets: tenantProcedure
    .input(
      occurrenceKeySchema.extend({
        items: z
          .array(z.object({ id: z.string().uuid(), orderIndex: z.number().int().min(0) }))
          .min(1)
          .max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");
      await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      await ctx.db.transaction(async (tx) => {
        for (const item of input.items) {
          await tx
            .update(trajetOccurrenceArrets)
            .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
            .where(
              and(
                eq(trajetOccurrenceArrets.tenantId, ctx.tenantId),
                eq(trajetOccurrenceArrets.trajetId, input.trajetId),
                eq(trajetOccurrenceArrets.date, input.date),
                or(
                  eq(trajetOccurrenceArrets.id, item.id),
                  eq(trajetOccurrenceArrets.baseArretId, item.id),
                ),
              ),
            );
        }
      });
      return { ok: true };
    }),

  /** Sets / locks a stop time for the day. */
  updateOccurrenceArret: tenantProcedure
    .input(
      occurrenceKeySchema.extend({
        stopId: z.string().uuid(),
        arrivalTime: z.string().max(16).nullable().optional(),
        timeLocked: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");
      await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      const result = await ctx.db
        .update(trajetOccurrenceArrets)
        .set({
          ...(input.arrivalTime !== undefined ? { arrivalTime: input.arrivalTime } : {}),
          ...(input.timeLocked !== undefined ? { timeLocked: input.timeLocked } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrenceArrets.tenantId, ctx.tenantId),
            eq(trajetOccurrenceArrets.trajetId, input.trajetId),
            eq(trajetOccurrenceArrets.date, input.date),
            or(
              eq(trajetOccurrenceArrets.id, input.stopId),
              eq(trajetOccurrenceArrets.baseArretId, input.stopId),
            ),
          ),
        )
        .returning({ id: trajetOccurrenceArrets.id });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arrêt non trouvé" });
      }
      return result[0];
    }),

  /** Drops the day customization of the stops (back to the base composition). */
  resetOccurrenceArrets: tenantProcedure
    .input(occurrenceKeySchema)
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, trajets, input.trajetId, ctx.tenantId, "Trajet");
      await ctx.db
        .delete(trajetOccurrenceArrets)
        .where(
          and(
            eq(trajetOccurrenceArrets.tenantId, ctx.tenantId),
            eq(trajetOccurrenceArrets.trajetId, input.trajetId),
            eq(trajetOccurrenceArrets.date, input.date),
          ),
        );
      await ctx.db
        .update(trajetOccurrences)
        .set({
          totalDistanceKm: null,
          totalDurationSeconds: null,
          routeGeometry: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrences.trajetId, input.trajetId),
            eq(trajetOccurrences.date, input.date),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        );
      return { ok: true };
    }),

  /** Computes the day's route (segments + totals + geometry for the map). */
  calculateOccurrenceRoute: tenantProcedure
    .input(occurrenceKeySchema)
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
      if (!trajet[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouvé" });
      }

      const stops = await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      if (stops.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Il faut au moins 2 arrêts pour calculer un trajet",
        });
      }
      if (!stops.every((s) => s.latitude != null && s.longitude != null)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tous les arrêts doivent avoir des coordonnées GPS",
        });
      }

      const avoidTolls = trajet[0].peages === false;
      const routingConfig = await resolveRoutingConfig(ctx.db, ctx.tenantId);

      let totalDistanceKm = 0;
      let totalDurationSeconds = 0;
      const allCoordinates: number[][] = [];
      const segmentResults: { id: string; distanceKm: number; durationSeconds: number }[] = [];

      for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1]!;
        const curr = stops[i]!;
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

      let simplified = allCoordinates;
      if (allCoordinates.length > 1000) {
        const step = Math.ceil(allCoordinates.length / 1000);
        simplified = allCoordinates.filter((_, idx) => idx % step === 0);
        const last = allCoordinates[allCoordinates.length - 1];
        if (last && simplified[simplified.length - 1] !== last) simplified.push(last);
      }
      const routeGeometry =
        simplified.length >= 2
          ? { type: "LineString" as const, coordinates: simplified }
          : null;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(trajetOccurrenceArrets)
          .set({ distanceKm: 0, durationSeconds: 0, updatedAt: new Date() })
          .where(eq(trajetOccurrenceArrets.id, stops[0]!.id));
        for (const seg of segmentResults) {
          await tx
            .update(trajetOccurrenceArrets)
            .set({
              distanceKm: seg.distanceKm,
              durationSeconds: seg.durationSeconds,
              updatedAt: new Date(),
            })
            .where(eq(trajetOccurrenceArrets.id, seg.id));
        }
        // Upsert the occurrence row with the day's totals + geometry.
        await tx
          .insert(trajetOccurrences)
          .values({
            tenantId: ctx.tenantId,
            trajetId: input.trajetId,
            date: input.date,
            totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
            totalDurationSeconds,
            routeGeometry,
          })
          .onConflictDoUpdate({
            target: [trajetOccurrences.trajetId, trajetOccurrences.date],
            set: {
              totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
              totalDurationSeconds,
              routeGeometry,
              updatedAt: new Date(),
            },
          });
      });

      return { totalDistanceKm, totalDurationSeconds };
    }),

  /** Recomputes the day's stop times (same anchor algorithm as the trajet). */
  calculateOccurrenceTimes: tenantProcedure
    .input(occurrenceKeySchema.extend({ waitTimeSeconds: z.number().min(0).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const trajet = await ctx.db
        .select({ direction: trajets.direction, departureTime: trajets.departureTime })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);
      if (!trajet[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouvé" });
      }

      const occ = await ctx.db
        .select({ departureTime: trajetOccurrences.departureTime })
        .from(trajetOccurrences)
        .where(
          and(
            eq(trajetOccurrences.trajetId, input.trajetId),
            eq(trajetOccurrences.date, input.date),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      const stops = await ensureMaterialized(ctx.db, ctx.tenantId, input.trajetId, input.date);
      if (stops.length < 2) return { updated: 0 };

      const anchorTime =
        occ[0]?.departureTime ?? trajet[0].departureTime ?? "08:00";
      const timeUpdates = computeStopTimes(
        stops,
        trajet[0].direction,
        anchorTime,
        input.waitTimeSeconds,
      );

      await ctx.db.transaction(async (tx) => {
        for (const u of timeUpdates) {
          await tx
            .update(trajetOccurrenceArrets)
            .set({ arrivalTime: u.arrivalTime, updatedAt: new Date() })
            .where(eq(trajetOccurrenceArrets.id, u.id));
        }
      });

      return { updated: stops.length };
    }),
} satisfies TRPCRouterRecord;

/* ------------------------------------------------------------------ */
/* Helpers for the day-scoped (materialized) stop composition          */
/* ------------------------------------------------------------------ */

type Db = typeof import("@scomap/db").db;

async function loadMaterializedStops(
  db: Db,
  tenantId: string,
  trajetId: string,
  date: string,
) {
  const rows = await db
    .select({
      id: trajetOccurrenceArrets.id,
      kind: trajetOccurrenceArrets.kind,
      type: trajetOccurrenceArrets.type,
      usagerAddressId: trajetOccurrenceArrets.usagerAddressId,
      etablissementId: trajetOccurrenceArrets.etablissementId,
      name: trajetOccurrenceArrets.name,
      address: trajetOccurrenceArrets.address,
      latitude: trajetOccurrenceArrets.latitude,
      longitude: trajetOccurrenceArrets.longitude,
      orderIndex: trajetOccurrenceArrets.orderIndex,
      arrivalTime: trajetOccurrenceArrets.arrivalTime,
      waitTime: trajetOccurrenceArrets.waitTime,
      distanceKm: trajetOccurrenceArrets.distanceKm,
      durationSeconds: trajetOccurrenceArrets.durationSeconds,
      timeLocked: trajetOccurrenceArrets.timeLocked,
      usagerId: usagers.id,
    })
    .from(trajetOccurrenceArrets)
    .leftJoin(
      usagerAddresses,
      and(
        eq(trajetOccurrenceArrets.usagerAddressId, usagerAddresses.id),
        eq(usagerAddresses.tenantId, tenantId),
      ),
    )
    .leftJoin(
      usagers,
      and(eq(usagerAddresses.usagerId, usagers.id), eq(usagers.tenantId, tenantId)),
    )
    .where(
      and(
        eq(trajetOccurrenceArrets.tenantId, tenantId),
        eq(trajetOccurrenceArrets.trajetId, trajetId),
        eq(trajetOccurrenceArrets.date, date),
      ),
    );

  return rows
    .map((r) => ({
      id: r.id,
      source: r.kind === "add" ? ("ajout" as const) : ("base" as const),
      type: r.type ?? "libre",
      usagerAddressId: r.usagerAddressId,
      etablissementId: r.etablissementId,
      name: r.name ?? "",
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      orderIndex: r.orderIndex ?? 0,
      arrivalTime: r.arrivalTime,
      waitTime: r.waitTime,
      distanceKm: r.distanceKm,
      durationSeconds: r.durationSeconds,
      timeLocked: r.timeLocked,
      usagerId: r.usagerId,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Copies the base stops of the day into materialized rows (idempotent). */
async function ensureMaterialized(
  db: Db,
  tenantId: string,
  trajetId: string,
  date: string,
) {
  const existing = await loadMaterializedStops(db, tenantId, trajetId, date);
  if (existing.length > 0) return existing;

  const baseStops = await resolveArretsForDate(db, tenantId, trajetId, date);
  if (baseStops.length > 0) {
    await db.insert(trajetOccurrenceArrets).values(
      baseStops.map((s, i) => ({
        tenantId,
        trajetId,
        date,
        kind: "base",
        baseArretId: s.id,
        type: s.type,
        usagerAddressId: s.usagerAddressId,
        etablissementId: s.etablissementId,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        orderIndex: i,
        arrivalTime: s.arrivalTime,
        waitTime: s.waitTime,
        distanceKm: s.distanceKm,
        durationSeconds: s.durationSeconds,
        timeLocked: s.timeLocked,
      })),
    );
  }
  return loadMaterializedStops(db, tenantId, trajetId, date);
}

/** Same anchor-based time propagation as trajets.calculateTimes. */
function computeStopTimes(
  stops: Awaited<ReturnType<typeof loadMaterializedStops>>,
  direction: string,
  anchorTime: string,
  extraWaitSeconds: number,
) {
  const updates: { id: string; arrivalTime: string }[] = [];

  if (direction === "aller") {
    const last = stops[stops.length - 1]!;
    let base = parseTimeToSeconds(last.arrivalTime || anchorTime);
    if (last.timeLocked && last.arrivalTime) base = parseTimeToSeconds(last.arrivalTime);
    if (!last.timeLocked) updates.push({ id: last.id, arrivalTime: secondsToTime(base) });
    let cumul = base;
    for (let i = stops.length - 2; i >= 0; i--) {
      const stop = stops[i]!;
      const next = stops[i + 1]!;
      if (stop.timeLocked && stop.arrivalTime) {
        cumul = parseTimeToSeconds(stop.arrivalTime);
        continue;
      }
      cumul -= (next.durationSeconds ?? 0) + (stop.waitTime ?? 0) * 60 + extraWaitSeconds;
      updates.push({ id: stop.id, arrivalTime: secondsToTime(cumul) });
    }
  } else {
    const first = stops[0]!;
    let base = parseTimeToSeconds(first.arrivalTime || anchorTime);
    if (first.timeLocked && first.arrivalTime) base = parseTimeToSeconds(first.arrivalTime);
    if (!first.timeLocked) updates.push({ id: first.id, arrivalTime: secondsToTime(base) });
    let cumul = base;
    for (let i = 1; i < stops.length; i++) {
      const stop = stops[i]!;
      if (stop.timeLocked && stop.arrivalTime) {
        cumul = parseTimeToSeconds(stop.arrivalTime);
        continue;
      }
      cumul += (stop.durationSeconds ?? 0) + (stops[i - 1]!.waitTime ?? 0) * 60 + extraWaitSeconds;
      updates.push({ id: stop.id, arrivalTime: secondsToTime(cumul) });
    }
  }
  return updates;
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(":");
  return (parseInt(parts[0] ?? "0", 10) * 3600) + (parseInt(parts[1] ?? "0", 10) * 60);
}

function secondsToTime(totalSeconds: number): string {
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600) % 24;
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

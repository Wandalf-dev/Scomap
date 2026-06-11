import { z } from "zod";
import { eq, and, isNull, sql, asc } from "drizzle-orm";
import {
  trajets,
  circuits,
  chauffeurs,
  vehicules,
  etablissements,
  arrets,
  avenants,
} from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { normalizeDays } from "@/lib/types/day-entry";
import { buildTrajetName } from "../../services/trajet-sync";
import type { TRPCRouterRecord } from "@trpc/server";

export const trajetQueries = {
  listByCircuit: tenantProcedure
    .input(
      z.object({
        circuitId: z.string().uuid(),
        // Resolution date (default: today). Providing an avenant date freezes
        // the circuit state as it is at that date ("as of the avenant date"
        // view): validity/counters of the trajets resolved at that date.
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // NB: named `today` but = reference date (can be a past date).
      const today = input.date ?? new Date().toISOString().slice(0, 10);
      // Temporal aggregates per trajet (usager presence, resolved by date)
      // to distinguish active / upcoming / ended trajets after an avenant.
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
          // For the "horaires calculés" state: active arrêts vs arrêts without a time.
          arretsActive: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and a.deleted_at is null and (a.valid_from is null or a.valid_from <= ${today}) and (a.valid_to is null or a.valid_to >= ${today}))::int`,
          arretsUntimed: sql<number>`(select count(*) from ${arrets} a where a.trajet_id = ${trajets.id} and a.deleted_at is null and a.arrival_time is null and (a.valid_from is null or a.valid_from <= ${today}) and (a.valid_to is null or a.valid_to >= ${today}))::int`,
        })
        .from(trajets)
        // Re-filter tenant on joins (anti-IDOR via injected FK)
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

      // Active first, ended last (then direction/name).
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
      // Re-filter tenant on joins (anti-IDOR via injected FK)
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
        // Re-filter tenant on joins (anti-IDOR via injected FK)
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
} satisfies TRPCRouterRecord;

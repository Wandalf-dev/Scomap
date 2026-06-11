import { z } from "zod";
import { eq, and, isNull, inArray, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  trajets,
  trajetOccurrences,
  circuits,
  chauffeurs,
  vehicules,
} from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { assertTenantOwned } from "../../ownership";
import { occurrenceOverrideSchema } from "@/lib/validators/trajet";
import { normalizeDays, isAnyDayActiveForDate, type DayEntry } from "@/lib/types/day-entry";
import type { TRPCRouterRecord } from "@trpc/server";

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
} satisfies TRPCRouterRecord;

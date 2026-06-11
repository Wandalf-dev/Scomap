import { z } from "zod";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  circuits,
  etablissements,
  trajets,
  arrets,
  usagerCircuits,
  avenants,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { assertTenantOwned } from "../ownership";
import {
  circuitSchema,
  circuitDetailSchema,
} from "@/lib/validators/circuit";
import { nextDisplayId } from "@/lib/db/display-id";
import {
  resolveScheduleAnchor,
  type EtablissementSchedules,
} from "../services/trajet-sync";
import { normalizeDays } from "@/lib/types/day-entry";


export const circuitsRouter = createTRPCRouter({
  // campaignId absent => production (preparation_campaign_id IS NULL).
  // campaignId provided => circuits of that preparation campaign.
  list: tenantProcedure
    .input(z.object({ campaignId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: circuits.id,
        displayId: circuits.displayId,
        name: circuits.name,
        code: circuits.code,
        description: circuits.description,
        status: circuits.status,
        archivedAt: circuits.archivedAt,
        startDate: circuits.startDate,
        endDate: circuits.endDate,
        etablissementId: circuits.etablissementId,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        trajetCount: sql<number>`(select count(*) from ${trajets} t where t.circuit_id = ${circuits.id} and t.deleted_at is null)::int`,
        totalKm: sql<number>`(select coalesce(sum(t.total_distance_km), 0) from ${trajets} t where t.circuit_id = ${circuits.id} and t.deleted_at is null)::float8`,
        avenantCount: sql<number>`(select count(*) from ${avenants} a where a.circuit_id = ${circuits.id} and a.deleted_at is null)::int`,
        usagerCount: sql<number>`(select count(*) from ${usagerCircuits} uc where uc.circuit_id = ${circuits.id} and uc.valid_to is null and uc.deleted_at is null)::int`,
        createdAt: circuits.createdAt,
        updatedAt: circuits.updatedAt,
      })
      .from(circuits)
      // Re-filter tenant on the join (anti-IDOR via injected FK)
      .leftJoin(
        etablissements,
        and(
          eq(circuits.etablissementId, etablissements.id),
          eq(etablissements.tenantId, ctx.tenantId),
        ),
      )
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          isNull(circuits.deletedAt),
          input?.campaignId
            ? eq(circuits.preparationCampaignId, input.campaignId)
            : isNull(circuits.preparationCampaignId),
        ),
      )
      .limit(500);

    return rows.map((row) => ({
      ...row,
    }));
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: circuits.id,
          displayId: circuits.displayId,
          name: circuits.name,
          code: circuits.code,
          description: circuits.description,
          status: circuits.status,
          archivedAt: circuits.archivedAt,
          startDate: circuits.startDate,
          endDate: circuits.endDate,
          etablissementId: circuits.etablissementId,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          // Number of assigned usagers (OPEN versions). > 0 ⇒ validity dates
          // are frozen (see lock in updateDetail / tab-informations).
          usagerCount: sql<number>`(select count(*) from ${usagerCircuits} uc where uc.circuit_id = ${circuits.id} and uc.valid_to is null and uc.deleted_at is null)::int`,
          createdAt: circuits.createdAt,
          updatedAt: circuits.updatedAt,
        })
        .from(circuits)
        .leftJoin(
          etablissements,
          and(
            eq(circuits.etablissementId, etablissements.id),
            eq(etablissements.tenantId, ctx.tenantId),
          ),
        )
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);

      const row = result[0] ?? null;
      if (!row) return null;
      return row;
    }),

  create: tenantProcedure
    .input(circuitSchema)
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, etablissements, input.etablissementId, ctx.tenantId, "Etablissement");
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "circuits");
      const result = await ctx.db
        .insert(circuits)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          name: input.name,
          etablissementId: input.etablissementId,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(circuitDetailSchema)
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, etablissements, input.etablissementId, ctx.tenantId, "Etablissement");
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "circuits");
      const result = await ctx.db
        .insert(circuits)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          name: input.name,
          code: input.code || null,
          etablissementId: input.etablissementId,
          description: input.description || null,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Echec de la creation" });
      }
      return created;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: circuitSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, etablissements, input.data.etablissementId, ctx.tenantId, "Etablissement");
      const result = await ctx.db
        .update(circuits)
        .set({
          name: input.data.name,
          etablissementId: input.data.etablissementId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: circuitDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTenantOwned(ctx.db, etablissements, input.data.etablissementId, ctx.tenantId, "Etablissement");

      // State before update: the établissement (to detect a destination change
      // that invalidates geometries/schedules) AND the validity dates
      // (for the lock below).
      const beforeRows = await ctx.db
        .select({
          etablissementId: circuits.etablissementId,
          startDate: circuits.startDate,
          endDate: circuits.endDate,
        })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);
      const before = beforeRows[0];

      // Business lock: once a circuit has at least one assigned usager (open
      // version), its start/end validity dates are frozen. Changing them would
      // break consistency with the transport periods of already-assigned usagers
      // (the assignment guard requires overlap). To modify them, first
      // dissociate all usagers from the circuit.
      const newStart = input.data.startDate || null;
      const newEnd = input.data.endDate || null;
      const datesChanged =
        before != null &&
        (before.startDate !== newStart || before.endDate !== newEnd);
      if (datesChanged) {
        const [{ count } = { count: 0 }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(usagerCircuits)
          .where(
            and(
              eq(usagerCircuits.circuitId, input.id),
              eq(usagerCircuits.tenantId, ctx.tenantId),
              isNull(usagerCircuits.validTo),
              isNull(usagerCircuits.deletedAt),
            ),
          );
        if (count > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Les dates de ce circuit ne peuvent pas être modifiées tant qu'il a des usagers. Retirez-les du circuit pour changer les dates.",
          });
        }
      }

      const result = await ctx.db
        .update(circuits)
        .set({
          name: input.data.name,
          code: input.data.code || null,
          status: input.data.status ?? undefined,
          etablissementId: input.data.etablissementId,
          description: input.data.description || null,
          startDate: input.data.startDate || null,
          endDate: input.data.endDate || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .returning();

      const updated = result[0];

      // If the destination établissement changes: the "établissement" arrêts still
      // point to the old one, and routes/schedules are stale.
      // Re-point the établissement arrêt + reset trajet calculations.
      if (
        updated &&
        before &&
        before.etablissementId !== input.data.etablissementId
      ) {
        const etabRows = await ctx.db
          .select({
            id: etablissements.id,
            name: etablissements.name,
            address: etablissements.address,
            city: etablissements.city,
            postalCode: etablissements.postalCode,
            latitude: etablissements.latitude,
            longitude: etablissements.longitude,
            schedules: etablissements.schedules,
          })
          .from(etablissements)
          .where(
            and(
              eq(etablissements.id, input.data.etablissementId),
              eq(etablissements.tenantId, ctx.tenantId),
            ),
          )
          .limit(1);
        const etab = etabRows[0];

        const trajetRows = await ctx.db
          .select({
            id: trajets.id,
            direction: trajets.direction,
            recurrence: trajets.recurrence,
          })
          .from(trajets)
          .where(
            and(
              eq(trajets.circuitId, input.id),
              eq(trajets.tenantId, ctx.tenantId),
              isNull(trajets.deletedAt),
            ),
          );
        const trajetIds = trajetRows.map((t) => t.id);

        if (etab && trajetIds.length > 0) {
          const etabAddress = [etab.address, etab.postalCode, etab.city]
            .filter(Boolean)
            .join(", ");

          for (const t of trajetRows) {
            const rec = t.recurrence as { daysOfWeek?: unknown } | null;
            const anchor = resolveScheduleAnchor(
              etab.schedules as EtablissementSchedules,
              t.direction,
              normalizeDays(rec?.daysOfWeek),
            );
            // Re-point this trajet's établissement arrêt to the new one,
            // re-snapshot coords/name/address + re-anchor the schedule (locked).
            await ctx.db
              .update(arrets)
              .set({
                etablissementId: etab.id,
                name: etab.name,
                address: etabAddress,
                latitude: etab.latitude ?? null,
                longitude: etab.longitude ?? null,
                arrivalTime: anchor,
                timeLocked: anchor != null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(arrets.trajetId, t.id),
                  eq(arrets.type, "etablissement"),
                  eq(arrets.tenantId, ctx.tenantId),
                  isNull(arrets.deletedAt),
                ),
              );
            // Re-anchor the reference time of the trajet.
            await ctx.db
              .update(trajets)
              .set({ departureTime: anchor, updatedAt: new Date() })
              .where(
                and(eq(trajets.id, t.id), eq(trajets.tenantId, ctx.tenantId)),
              );
          }

          // Reset geometry/distance/duration (recalculation needed).
          await ctx.db
            .update(trajets)
            .set({
              routeGeometry: null,
              totalDistanceKm: null,
              totalDurationSeconds: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(trajets.id, trajetIds),
                eq(trajets.tenantId, ctx.tenantId),
              ),
            );

          // Reset the PEC schedules of non-locked arrêts.
          await ctx.db
            .update(arrets)
            .set({ arrivalTime: null, updatedAt: new Date() })
            .where(
              and(
                inArray(arrets.trajetId, trajetIds),
                eq(arrets.tenantId, ctx.tenantId),
                eq(arrets.timeLocked, false),
                isNull(arrets.deletedAt),
              ),
            );
        }
      }

      return updated ?? null;
    }),

  // Archiving / unarchiving (lifecycle, distinct from deletion).
  setArchived: tenantProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(circuits)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .returning();
      return result[0] ?? null;
    }),

  // Bulk archiving (multiple selection).
  setArchivedMany: tenantProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
        archived: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { updated: 0 };
      const result = await ctx.db
        .update(circuits)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(circuits.tenantId, ctx.tenantId),
            inArray(circuits.id, input.ids),
            isNull(circuits.deletedAt),
          ),
        )
        .returning({ id: circuits.id });
      return { updated: result.length };
    }),

  // Bulk update of validity dates (start / end).
  updateDatesMany: tenantProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { updated: 0, skipped: 0 };

      // Business lock (consistent with updateDetail): a circuit that has
      // assigned usagers (open version) has its dates frozen. They are skipped
      // in the batch rather than failing the whole operation; the count is returned.
      const lockedRows = await ctx.db
        .select({ circuitId: usagerCircuits.circuitId })
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.tenantId, ctx.tenantId),
            inArray(usagerCircuits.circuitId, input.ids),
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        )
        .groupBy(usagerCircuits.circuitId);
      const lockedSet = new Set(lockedRows.map((r) => r.circuitId));
      const editableIds = input.ids.filter((id) => !lockedSet.has(id));
      if (editableIds.length === 0) {
        return { updated: 0, skipped: input.ids.length };
      }

      // Only update explicitly provided fields (undefined = unchanged).
      const patch: { startDate?: string | null; endDate?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (input.startDate !== undefined) patch.startDate = input.startDate || null;
      if (input.endDate !== undefined) patch.endDate = input.endDate || null;
      const result = await ctx.db
        .update(circuits)
        .set(patch)
        .where(
          and(
            eq(circuits.tenantId, ctx.tenantId),
            inArray(circuits.id, editableIds),
            isNull(circuits.deletedAt),
          ),
        )
        .returning({ id: circuits.id });
      return { updated: result.length, skipped: input.ids.length - editableIds.length };
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      const result = await ctx.db
        .update(circuits)
        .set({ deletedAt: now })
        .where(
          and(
            eq(circuits.id, input.id),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .returning();

      if (result[0]) {
        // Soft-delete all trajets of this circuit
        await ctx.db
          .update(trajets)
          .set({ deletedAt: now })
          .where(
            and(
              eq(trajets.tenantId, ctx.tenantId),
              eq(trajets.circuitId, input.id),
              isNull(trajets.deletedAt),
            ),
          );

        // Soft-delete usager-circuit associations (preserves the dated history).
        await ctx.db
          .update(usagerCircuits)
          .set({ deletedAt: now })
          .where(
            and(
              eq(usagerCircuits.tenantId, ctx.tenantId),
              eq(usagerCircuits.circuitId, input.id),
              isNull(usagerCircuits.deletedAt),
            ),
          );
      }

      return result[0] ?? null;
    }),

  deleteMany: tenantProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { deleted: 0 };

      const now = new Date();

      const result = await ctx.db
        .update(circuits)
        .set({ deletedAt: now })
        .where(
          and(
            eq(circuits.tenantId, ctx.tenantId),
            inArray(circuits.id, input.ids),
            isNull(circuits.deletedAt),
          ),
        )
        .returning({ id: circuits.id });

      if (result.length > 0) {
        const deletedIds = result.map((r) => r.id);

        // Soft-delete all trajets of these circuits
        await ctx.db
          .update(trajets)
          .set({ deletedAt: now })
          .where(
            and(
              eq(trajets.tenantId, ctx.tenantId),
              inArray(trajets.circuitId, deletedIds),
              isNull(trajets.deletedAt),
            ),
          );

        // Soft-delete usager-circuit associations (consistent with the rest:
        // we preserve the dated history rather than hard-deleting).
        await ctx.db
          .update(usagerCircuits)
          .set({ deletedAt: now })
          .where(
            and(
              eq(usagerCircuits.tenantId, ctx.tenantId),
              inArray(usagerCircuits.circuitId, deletedIds),
              isNull(usagerCircuits.deletedAt),
            ),
          );
      }

      return { deleted: result.length };
    }),
});

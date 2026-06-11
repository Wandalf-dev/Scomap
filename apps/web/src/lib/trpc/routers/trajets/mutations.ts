import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { trajets, chauffeurs, vehicules } from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { assertTenantOwned } from "../../ownership";
import { trajetSchema, trajetDetailSchema } from "@/lib/validators/trajet";
import { nextDisplayId } from "@/lib/db/display-id";
import { assertCircuitOwned, autoCreateEtablissementArret } from "./helpers";
import type { TRPCRouterRecord } from "@trpc/server";

export const trajetMutations = {
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
} satisfies TRPCRouterRecord;

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { circuits, etablissements, trajets, usagerCircuits } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  circuitSchema,
  circuitDetailSchema,
} from "@/lib/validators/circuit";
import { normalizeDays } from "@/lib/types/day-entry";

export const circuitsRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: circuits.id,
        name: circuits.name,
        description: circuits.description,
        isActive: circuits.isActive,
        operatingDays: circuits.operatingDays,
        startDate: circuits.startDate,
        endDate: circuits.endDate,
        etablissementId: circuits.etablissementId,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        createdAt: circuits.createdAt,
        updatedAt: circuits.updatedAt,
      })
      .from(circuits)
      .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          isNull(circuits.deletedAt),
        ),
      )
      .limit(500);

    return rows.map((row) => ({
      ...row,
      operatingDays: normalizeDays(row.operatingDays),
    }));
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: circuits.id,
          name: circuits.name,
          description: circuits.description,
          isActive: circuits.isActive,
          operatingDays: circuits.operatingDays,
          startDate: circuits.startDate,
          endDate: circuits.endDate,
          etablissementId: circuits.etablissementId,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          createdAt: circuits.createdAt,
          updatedAt: circuits.updatedAt,
        })
        .from(circuits)
        .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
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
      return { ...row, operatingDays: normalizeDays(row.operatingDays) };
    }),

  create: tenantProcedure
    .input(circuitSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(circuits)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          etablissementId: input.etablissementId,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(circuitDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(circuits)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          etablissementId: input.etablissementId,
          description: input.description || null,
          operatingDays: input.operatingDays ?? null,
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
      const result = await ctx.db
        .update(circuits)
        .set({
          name: input.data.name,
          etablissementId: input.data.etablissementId,
          description: input.data.description || null,
          operatingDays: input.data.operatingDays ?? null,
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

      return result[0] ?? null;
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
              eq(trajets.circuitId, input.id),
              isNull(trajets.deletedAt),
            ),
          );

        // Delete usager-circuit associations
        await ctx.db
          .delete(usagerCircuits)
          .where(eq(usagerCircuits.circuitId, input.id));
      }

      return result[0] ?? null;
    }),
});

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { circuits, etablissements } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  circuitSchema,
  circuitDetailSchema,
} from "@/lib/validators/circuit";

export const circuitsRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: circuits.id,
        name: circuits.name,
        description: circuits.description,
        isActive: circuits.isActive,
        operatingDays: circuits.operatingDays,
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

      return result[0] ?? null;
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
      const result = await ctx.db
        .update(circuits)
        .set({ deletedAt: new Date() })
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
});

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { usagers, etablissements } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { usagerSchema, usagerDetailSchema } from "@/lib/validators/usager";

export const usagersRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: usagers.id,
        code: usagers.code,
        firstName: usagers.firstName,
        lastName: usagers.lastName,
        birthDate: usagers.birthDate,
        gender: usagers.gender,
        etablissementId: usagers.etablissementId,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        notes: usagers.notes,
        createdAt: usagers.createdAt,
        updatedAt: usagers.updatedAt,
      })
      .from(usagers)
      .leftJoin(etablissements, eq(usagers.etablissementId, etablissements.id))
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          isNull(usagers.deletedAt),
        ),
      );
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: usagers.id,
          code: usagers.code,
          firstName: usagers.firstName,
          lastName: usagers.lastName,
          birthDate: usagers.birthDate,
          gender: usagers.gender,
          etablissementId: usagers.etablissementId,
          etablissementName: etablissements.name,
          notes: usagers.notes,
          createdAt: usagers.createdAt,
          updatedAt: usagers.updatedAt,
        })
        .from(usagers)
        .leftJoin(etablissements, eq(usagers.etablissementId, etablissements.id))
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(usagerSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          etablissementId: input.etablissementId || null,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(usagerDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          code: input.code || null,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          etablissementId: input.etablissementId || null,
          notes: input.notes || null,
        })
        .returning();

      return result[0]!;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: usagerDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagers)
        .set({
          code: input.data.code || null,
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          birthDate: input.data.birthDate || null,
          gender: input.data.gender || null,
          etablissementId: input.data.etablissementId || null,
          notes: input.data.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

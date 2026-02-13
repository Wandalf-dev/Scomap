import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { usagers, etablissements } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { usagerSchema, usagerDetailSchema } from "@/lib/validators/usager";
import { alias } from "drizzle-orm/pg-core";

const secondaryEtab = alias(etablissements, "secondary_etab");

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
        status: usagers.status,
        regime: usagers.regime,
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
          status: usagers.status,
          regime: usagers.regime,
          etablissementId: usagers.etablissementId,
          etablissementName: etablissements.name,
          secondaryEtablissementId: usagers.secondaryEtablissementId,
          secondaryEtablissementName: secondaryEtab.name,
          transportStartDate: usagers.transportStartDate,
          transportEndDate: usagers.transportEndDate,
          transportParticularity: usagers.transportParticularity,
          specificity: usagers.specificity,
          notes: usagers.notes,
          createdAt: usagers.createdAt,
          updatedAt: usagers.updatedAt,
        })
        .from(usagers)
        .leftJoin(etablissements, eq(usagers.etablissementId, etablissements.id))
        .leftJoin(secondaryEtab, eq(usagers.secondaryEtablissementId, secondaryEtab.id))
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
          status: input.status || "brouillon",
          regime: input.regime || null,
          etablissementId: input.etablissementId || null,
          secondaryEtablissementId: input.secondaryEtablissementId || null,
          transportStartDate: input.transportStartDate || null,
          transportEndDate: input.transportEndDate || null,
          transportParticularity: input.transportParticularity || null,
          specificity: input.specificity || null,
          notes: input.notes || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Échec de la création" });
      }
      return created;
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
          status: input.data.status || "brouillon",
          regime: input.data.regime || null,
          etablissementId: input.data.etablissementId || null,
          secondaryEtablissementId: input.data.secondaryEtablissementId || null,
          transportStartDate: input.data.transportStartDate || null,
          transportEndDate: input.data.transportEndDate || null,
          transportParticularity: input.data.transportParticularity || null,
          specificity: input.data.specificity || null,
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

import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { usagers, etablissements, tenantSettings } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { usagerSchema, usagerDetailSchema } from "@/lib/validators/usager";
import { alias } from "drizzle-orm/pg-core";
import { nextDisplayId } from "@/lib/db/display-id";

const secondaryEtab = alias(etablissements, "secondary_etab");

export const usagersRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: usagers.id,
        displayId: usagers.displayId,
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
        secondaryEtablissementId: usagers.secondaryEtablissementId,
        secondaryEtablissementName: secondaryEtab.name,
        classe: usagers.classe,
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
          etablissementType: etablissements.type,
          secondaryEtablissementId: usagers.secondaryEtablissementId,
          secondaryEtablissementName: secondaryEtab.name,
          classe: usagers.classe,
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
      // Récupérer les dates d'année scolaire pour pré-remplir
      const settings = await ctx.db
        .select({
          schoolYearStart: tenantSettings.schoolYearStart,
          schoolYearEnd: tenantSettings.schoolYearEnd,
        })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, ctx.tenantId))
        .limit(1)
        .then((rows) => rows[0]);

      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "usagers");
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          etablissementId: input.etablissementId || null,
          transportStartDate: settings?.schoolYearStart ?? null,
          transportEndDate: settings?.schoolYearEnd ?? null,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(usagerDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "usagers");
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          code: input.code || null,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          status: input.status || "brouillon",
          regime: input.regime || null,
          etablissementId: input.etablissementId || null,
          secondaryEtablissementId: input.secondaryEtablissementId || null,
          classe: input.classe || null,
          transportStartDate: input.transportStartDate,
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

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: usagerSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagers)
        .set({
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          birthDate: input.data.birthDate || null,
          gender: input.data.gender || null,
          etablissementId: input.data.etablissementId || null,
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
          classe: input.data.classe || null,
          transportStartDate: input.data.transportStartDate,
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

  deleteMany: tenantProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { deleted: 0 };

      const result = await ctx.db
        .update(usagers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(usagers.tenantId, ctx.tenantId),
            inArray(usagers.id, input.ids),
            isNull(usagers.deletedAt),
          ),
        )
        .returning({ id: usagers.id });

      return { deleted: result.length };
    }),
});

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { etablissements, arrets } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  etablissementSchema,
  etablissementDetailSchema,
  schedulesSchema,
} from "@/lib/validators/etablissement";

export const etablissementsRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(etablissements)
      .where(
        and(
          eq(etablissements.tenantId, ctx.tenantId),
          isNull(etablissements.deletedAt),
        ),
      );
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(etablissements)
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(etablissementSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(etablissements)
        .values({
          ...input,
          email: input.email || null,
          tenantId: ctx.tenantId,
        })
        .returning();

      return result[0];
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: etablissementSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(etablissements)
        .set({
          ...input.data,
          email: input.data.email === "" ? null : input.data.email,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(etablissements)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  createFull: tenantProcedure
    .input(etablissementDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(etablissements)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          type: input.type,
          regime: input.regime || null,
          codeUai: input.codeUai || null,
          color: input.color || null,
          address: input.address,
          city: input.city || null,
          postalCode: input.postalCode || null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          phone: input.phone || null,
          email: input.email === "" ? null : input.email || null,
          website: input.website || null,
          managerCivility: input.managerCivility || null,
          managerName: input.managerName || null,
          managerPhone: input.managerPhone || null,
          managerEmail: input.managerEmail === "" ? null : input.managerEmail || null,
          observations: input.observations || null,
        })
        .returning();

      return result[0]!;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: etablissementDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(etablissements)
        .set({
          name: input.data.name,
          type: input.data.type,
          regime: input.data.regime || null,
          codeUai: input.data.codeUai || null,
          color: input.data.color || null,
          address: input.data.address,
          city: input.data.city || null,
          postalCode: input.data.postalCode || null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          phone: input.data.phone || null,
          email: input.data.email === "" ? null : input.data.email || null,
          website: input.data.website || null,
          managerCivility: input.data.managerCivility || null,
          managerName: input.data.managerName || null,
          managerPhone: input.data.managerPhone || null,
          managerEmail: input.data.managerEmail === "" ? null : input.data.managerEmail || null,
          observations: input.data.observations || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .returning();

      const updated = result[0];
      if (updated && updated.latitude != null && updated.longitude != null) {
        await ctx.db
          .update(arrets)
          .set({
            latitude: updated.latitude,
            longitude: updated.longitude,
            name: updated.name,
            address: [updated.address, updated.postalCode, updated.city]
              .filter(Boolean)
              .join(", "),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(arrets.etablissementId, updated.id),
              isNull(arrets.deletedAt),
            ),
          );
      }

      return updated ?? null;
    }),

  updateSchedules: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        schedules: schedulesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(etablissements)
        .set({
          schedules: input.schedules,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

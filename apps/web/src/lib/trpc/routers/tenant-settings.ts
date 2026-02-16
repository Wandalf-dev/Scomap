import { z } from "zod";
import { eq } from "drizzle-orm";
import { tenantSettings } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";

const tenantSettingsSchema = z.object({
  schoolYearStart: z.string().nullable(),
  schoolYearEnd: z.string().nullable(),
});

export const tenantSettingsRouter = createTRPCRouter({
  get: tenantProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: tenantSettings.id,
        schoolYearStart: tenantSettings.schoolYearStart,
        schoolYearEnd: tenantSettings.schoolYearEnd,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, ctx.tenantId))
      .limit(1);

    return result[0] ?? null;
  }),

  update: tenantProcedure
    .input(tenantSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: tenantSettings.id })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, ctx.tenantId))
        .limit(1);

      if (existing[0]) {
        const result = await ctx.db
          .update(tenantSettings)
          .set({
            schoolYearStart: input.schoolYearStart,
            schoolYearEnd: input.schoolYearEnd,
            updatedAt: new Date(),
          })
          .where(eq(tenantSettings.tenantId, ctx.tenantId))
          .returning();

        return result[0] ?? null;
      }

      const result = await ctx.db
        .insert(tenantSettings)
        .values({
          tenantId: ctx.tenantId,
          schoolYearStart: input.schoolYearStart,
          schoolYearEnd: input.schoolYearEnd,
        })
        .returning();

      return result[0] ?? null;
    }),
});

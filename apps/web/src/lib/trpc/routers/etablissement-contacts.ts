import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { etablissementContacts } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { etablissementContactSchema } from "@/lib/validators/etablissement-contact";

export const etablissementContactsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ etablissementId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(etablissementContacts)
        .where(
          and(
            eq(etablissementContacts.etablissementId, input.etablissementId),
            eq(etablissementContacts.tenantId, ctx.tenantId),
          ),
        );
    }),

  create: tenantProcedure
    .input(
      z.object({
        etablissementId: z.string().uuid(),
        data: etablissementContactSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(etablissementContacts)
        .values({
          etablissementId: input.etablissementId,
          tenantId: ctx.tenantId,
          civility: input.data.civility || null,
          lastName: input.data.lastName,
          firstName: input.data.firstName || null,
          function: input.data.function || null,
          phone: input.data.phone || null,
          email: input.data.email === "" ? null : input.data.email || null,
          observations: input.data.observations || null,
        })
        .returning();

      return result[0];
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: etablissementContactSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(etablissementContacts)
        .set({
          civility: input.data.civility || null,
          lastName: input.data.lastName,
          firstName: input.data.firstName || null,
          function: input.data.function || null,
          phone: input.data.phone || null,
          email: input.data.email === "" ? null : input.data.email || null,
          observations: input.data.observations || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(etablissementContacts.id, input.id),
            eq(etablissementContacts.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(etablissementContacts)
        .where(
          and(
            eq(etablissementContacts.id, input.id),
            eq(etablissementContacts.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

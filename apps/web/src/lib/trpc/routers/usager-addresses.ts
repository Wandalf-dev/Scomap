import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { usagerAddresses } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { usagerAddressSchema } from "@/lib/validators/usager-address";

export const usagerAddressesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ usagerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.usagerId, input.usagerId),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        )
        .orderBy(usagerAddresses.position);
    }),

  create: tenantProcedure
    .input(
      z.object({
        usagerId: z.string().uuid(),
        data: usagerAddressSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(usagerAddresses)
        .values({
          usagerId: input.usagerId,
          tenantId: ctx.tenantId,
          position: input.data.position,
          label: input.data.label || null,
          civility: input.data.civility || null,
          responsibleLastName: input.data.responsibleLastName || null,
          responsibleFirstName: input.data.responsibleFirstName || null,
          address: input.data.address || null,
          city: input.data.city || null,
          postalCode: input.data.postalCode || null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          phone: input.data.phone || null,
          mobile: input.data.mobile || null,
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
        data: usagerAddressSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagerAddresses)
        .set({
          position: input.data.position,
          label: input.data.label || null,
          civility: input.data.civility || null,
          responsibleLastName: input.data.responsibleLastName || null,
          responsibleFirstName: input.data.responsibleFirstName || null,
          address: input.data.address || null,
          city: input.data.city || null,
          postalCode: input.data.postalCode || null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          phone: input.data.phone || null,
          mobile: input.data.mobile || null,
          email: input.data.email === "" ? null : input.data.email || null,
          observations: input.data.observations || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagerAddresses.id, input.id),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.id, input.id),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { usagerAddresses, usagers } from "@scomap/db/schema";
import { db as dbInstance } from "@scomap/db";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  usagerAddressSchema,
  type UsagerAddressFormValues,
} from "@/lib/validators/usager-address";
import { normalizeDays } from "@/lib/types/day-entry";

function mapAddressData(data: UsagerAddressFormValues) {
  return {
    position: data.position,
    type: data.type || null,
    civility: data.civility || null,
    responsibleLastName: data.responsibleLastName || null,
    responsibleFirstName: data.responsibleFirstName || null,
    address: data.address || null,
    city: data.city || null,
    postalCode: data.postalCode || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    phone: data.phone || null,
    mobile: data.mobile || null,
    secondaryPhone: data.secondaryPhone || null,
    secondaryMobile: data.secondaryMobile || null,
    email: data.email === "" ? null : data.email || null,
    authorizedPerson: data.authorizedPerson || null,
    observations: data.observations || null,
    daysAller: data.daysAller ?? null,
    daysRetour: data.daysRetour ?? null,
  };
}

async function assertUsagerOwnership(
  db: typeof dbInstance,
  usagerId: string,
  tenantId: string,
) {
  const usager = await db
    .select({ id: usagers.id })
    .from(usagers)
    .where(
      and(
        eq(usagers.id, usagerId),
        eq(usagers.tenantId, tenantId),
        isNull(usagers.deletedAt),
      ),
    )
    .limit(1);

  if (usager.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Usager non trouvé" });
  }
}

export const usagerAddressesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ usagerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.usagerId, input.usagerId),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        )
        .orderBy(usagerAddresses.position);

      return rows.map((row) => ({
        ...row,
        daysAller: normalizeDays(row.daysAller),
        daysRetour: normalizeDays(row.daysRetour),
      }));
    }),

  create: tenantProcedure
    .input(
      z.object({
        usagerId: z.string().uuid(),
        data: usagerAddressSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertUsagerOwnership(ctx.db, input.usagerId, ctx.tenantId);

      // Auto-assign next position
      const existing = await ctx.db
        .select({ position: usagerAddresses.position })
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.usagerId, input.usagerId),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        );

      const usedPositions = new Set(existing.map((r) => r.position));
      let nextPosition = 1;
      while (usedPositions.has(nextPosition) && nextPosition <= 4) nextPosition++;

      if (nextPosition > 4) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 4 adresses par usager" });
      }

      const result = await ctx.db
        .insert(usagerAddresses)
        .values({
          usagerId: input.usagerId,
          tenantId: ctx.tenantId,
          ...mapAddressData(input.data),
          position: nextPosition,
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
          ...mapAddressData(input.data),
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

  reorder: tenantProcedure
    .input(
      z.object({
        items: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(1).max(4) })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.items.map((item) =>
          ctx.db
            .update(usagerAddresses)
            .set({ position: item.position, updatedAt: new Date() })
            .where(
              and(
                eq(usagerAddresses.id, item.id),
                eq(usagerAddresses.tenantId, ctx.tenantId),
              ),
            ),
        ),
      );
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

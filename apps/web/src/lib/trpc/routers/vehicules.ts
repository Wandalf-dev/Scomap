import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { vehicules } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  vehiculeSchema,
  vehiculeDetailSchema,
  vehiculeMaintenanceSchema,
} from "@/lib/validators/vehicule";

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

export const vehiculesRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: vehicules.id,
        name: vehicules.name,
        licensePlate: vehicules.licensePlate,
        brand: vehicules.brand,
        model: vehicules.model,
        year: vehicules.year,
        capacity: vehicules.capacity,
        wheelchairAccessible: vehicules.wheelchairAccessible,
        isActive: vehicules.isActive,
        createdAt: vehicules.createdAt,
        updatedAt: vehicules.updatedAt,
      })
      .from(vehicules)
      .where(
        and(
          eq(vehicules.tenantId, ctx.tenantId),
          isNull(vehicules.deletedAt),
        ),
      );
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: vehicules.id,
          name: vehicules.name,
          licensePlate: vehicules.licensePlate,
          brand: vehicules.brand,
          model: vehicules.model,
          year: vehicules.year,
          capacity: vehicules.capacity,
          wheelchairAccessible: vehicules.wheelchairAccessible,
          insuranceExpiry: vehicules.insuranceExpiry,
          technicalControlExpiry: vehicules.technicalControlExpiry,
          notes: vehicules.notes,
          isActive: vehicules.isActive,
          createdAt: vehicules.createdAt,
          updatedAt: vehicules.updatedAt,
        })
        .from(vehicules)
        .where(
          and(
            eq(vehicules.id, input.id),
            eq(vehicules.tenantId, ctx.tenantId),
            isNull(vehicules.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(vehiculeSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(vehicules)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          licensePlate: input.licensePlate || null,
          capacity: parseIntOrNull(input.capacity),
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(vehiculeDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(vehicules)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          licensePlate: input.licensePlate || null,
          brand: input.brand || null,
          model: input.model || null,
          year: parseIntOrNull(input.year),
          capacity: parseIntOrNull(input.capacity),
          wheelchairAccessible: input.wheelchairAccessible ?? false,
          notes: input.notes || null,
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
        data: vehiculeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(vehicules)
        .set({
          name: input.data.name,
          licensePlate: input.data.licensePlate || null,
          capacity: parseIntOrNull(input.data.capacity),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vehicules.id, input.id),
            eq(vehicules.tenantId, ctx.tenantId),
            isNull(vehicules.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: vehiculeDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(vehicules)
        .set({
          name: input.data.name,
          licensePlate: input.data.licensePlate || null,
          brand: input.data.brand || null,
          model: input.data.model || null,
          year: parseIntOrNull(input.data.year),
          capacity: parseIntOrNull(input.data.capacity),
          wheelchairAccessible: input.data.wheelchairAccessible ?? false,
          notes: input.data.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vehicules.id, input.id),
            eq(vehicules.tenantId, ctx.tenantId),
            isNull(vehicules.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateMaintenance: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: vehiculeMaintenanceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(vehicules)
        .set({
          insuranceExpiry: input.data.insuranceExpiry || null,
          technicalControlExpiry: input.data.technicalControlExpiry || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vehicules.id, input.id),
            eq(vehicules.tenantId, ctx.tenantId),
            isNull(vehicules.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(vehicules)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(vehicules.id, input.id),
            eq(vehicules.tenantId, ctx.tenantId),
            isNull(vehicules.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

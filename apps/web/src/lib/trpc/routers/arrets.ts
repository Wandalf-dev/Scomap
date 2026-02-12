import { z } from "zod";
import { eq, and, asc, isNull } from "drizzle-orm";
import {
  arrets,
  circuits,
  usagerAddresses,
  usagers,
  etablissements,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import { arretSchema } from "@/lib/validators/circuit";

export const arretsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify circuit ownership
      const circuit = await ctx.db
        .select({ id: circuits.id })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.circuitId),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);

      if (circuit.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Circuit non trouve" });
      }

      const rows = await ctx.db
        .select({
          id: arrets.id,
          circuitId: arrets.circuitId,
          type: arrets.type,
          usagerAddressId: arrets.usagerAddressId,
          etablissementId: arrets.etablissementId,
          name: arrets.name,
          address: arrets.address,
          latitude: arrets.latitude,
          longitude: arrets.longitude,
          orderIndex: arrets.orderIndex,
          arrivalTime: arrets.arrivalTime,
          waitTime: arrets.waitTime,
          createdAt: arrets.createdAt,
          updatedAt: arrets.updatedAt,
          // Joined usager info
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
          usagerAddressLabel: usagerAddresses.label,
          // Joined etablissement info
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
        })
        .from(arrets)
        .leftJoin(
          usagerAddresses,
          eq(arrets.usagerAddressId, usagerAddresses.id),
        )
        .leftJoin(usagers, eq(usagerAddresses.usagerId, usagers.id))
        .leftJoin(
          etablissements,
          eq(arrets.etablissementId, etablissements.id),
        )
        .where(eq(arrets.circuitId, input.circuitId))
        .orderBy(asc(arrets.orderIndex));

      return rows;
    }),

  create: tenantProcedure
    .input(
      z.object({
        circuitId: z.string().uuid(),
        data: arretSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify circuit ownership
      const circuit = await ctx.db
        .select({ id: circuits.id })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.circuitId),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);

      if (circuit.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Circuit non trouve" });
      }

      const result = await ctx.db
        .insert(arrets)
        .values({
          circuitId: input.circuitId,
          type: input.data.type,
          usagerAddressId: input.data.usagerAddressId ?? null,
          etablissementId: input.data.etablissementId ?? null,
          name: input.data.name,
          address: input.data.address || null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          orderIndex: input.data.orderIndex,
          arrivalTime: input.data.arrivalTime || null,
          waitTime: input.data.waitTime ?? null,
        })
        .returning();

      return result[0];
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        circuitId: z.string().uuid(),
        data: arretSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify circuit ownership
      const circuit = await ctx.db
        .select({ id: circuits.id })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.circuitId),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);

      if (circuit.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Circuit non trouve" });
      }

      const result = await ctx.db
        .update(arrets)
        .set({
          type: input.data.type,
          usagerAddressId: input.data.usagerAddressId ?? null,
          etablissementId: input.data.etablissementId ?? null,
          name: input.data.name,
          address: input.data.address || null,
          latitude: input.data.latitude ?? null,
          longitude: input.data.longitude ?? null,
          orderIndex: input.data.orderIndex,
          arrivalTime: input.data.arrivalTime || null,
          waitTime: input.data.waitTime ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.circuitId, input.circuitId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid(), circuitId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify circuit ownership
      const circuit = await ctx.db
        .select({ id: circuits.id })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.circuitId),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);

      if (circuit.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Circuit non trouve" });
      }

      const result = await ctx.db
        .delete(arrets)
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.circuitId, input.circuitId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

import { z } from "zod";
import { eq, and, asc, isNull } from "drizzle-orm";
import {
  arrets,
  trajets,
  usagerAddresses,
  usagers,
  etablissements,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import { arretSchema } from "@/lib/validators/trajet";

export const arretsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ trajetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify trajet ownership
      const trajet = await ctx.db
        .select({ id: trajets.id })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const rows = await ctx.db
        .select({
          id: arrets.id,
          trajetId: arrets.trajetId,
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
        .where(
          and(
            eq(arrets.trajetId, input.trajetId),
            isNull(arrets.deletedAt),
          ),
        )
        .orderBy(asc(arrets.orderIndex));

      return rows;
    }),

  create: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        data: arretSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trajet ownership
      const trajet = await ctx.db
        .select({ id: trajets.id })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const result = await ctx.db
        .insert(arrets)
        .values({
          tenantId: ctx.tenantId,
          trajetId: input.trajetId,
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
        trajetId: z.string().uuid(),
        data: arretSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trajet ownership
      const trajet = await ctx.db
        .select({ id: trajets.id })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
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
            eq(arrets.trajetId, input.trajetId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid(), trajetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify trajet ownership
      const trajet = await ctx.db
        .select({ id: trajets.id })
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      if (trajet.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const result = await ctx.db
        .update(arrets)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.trajetId, input.trajetId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

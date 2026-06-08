import { z } from "zod";
import { eq, and, asc, isNull, or, lte, gte } from "drizzle-orm";
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
    .input(
      z.object({
        trajetId: z.string().uuid(),
        // true = TOUS les arrêts non supprimés (composition complète du trajet,
        // y compris ceux à venir) — pour la fiche trajet. Défaut = présence
        // active aujourd'hui (recap/aperçu).
        all: z.boolean().optional(),
      }),
    )
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

      const today = new Date().toISOString().slice(0, 10);

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
          distanceKm: arrets.distanceKm,
          durationSeconds: arrets.durationSeconds,
          timeLocked: arrets.timeLocked,
          createdAt: arrets.createdAt,
          updatedAt: arrets.updatedAt,
          // Joined usager info
          usagerId: usagers.id,
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
          usagerAddressType: usagerAddresses.type,
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
            // Présence active aujourd'hui (arrêts bornés par avenant), sauf en
            // mode `all` où l'on renvoie toute la composition du trajet.
            ...(input.all
              ? []
              : [
                  or(isNull(arrets.validFrom), lte(arrets.validFrom, today)),
                  or(isNull(arrets.validTo), gte(arrets.validTo, today)),
                ]),
          ),
        )
        .orderBy(asc(arrets.orderIndex));

      return rows;
    }),

  // Arrêts d'un trajet RÉSOLUS à une date donnée : ne renvoie que la présence
  // active ce jour-là (les avenants bornent les arrêts dans le temps). Permet
  // au planning d'afficher les bons usagers pour une occurrence future.
  forDate: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      return ctx.db
        .select({
          id: arrets.id,
          type: arrets.type,
          name: arrets.name,
          address: arrets.address,
          orderIndex: arrets.orderIndex,
          arrivalTime: arrets.arrivalTime,
          usagerId: usagers.id,
        })
        .from(arrets)
        .leftJoin(
          usagerAddresses,
          eq(arrets.usagerAddressId, usagerAddresses.id),
        )
        .leftJoin(usagers, eq(usagerAddresses.usagerId, usagers.id))
        .where(
          and(
            eq(arrets.trajetId, input.trajetId),
            isNull(arrets.deletedAt),
            or(isNull(arrets.validFrom), lte(arrets.validFrom, input.date)),
            or(isNull(arrets.validTo), gte(arrets.validTo, input.date)),
          ),
        )
        .orderBy(asc(arrets.orderIndex));
    }),

  create: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        data: arretSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trajet ownership + get direction
      const trajet = await ctx.db
        .select({ id: trajets.id, direction: trajets.direction })
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

      // Existing stops to compute the insertion position.
      const existing = await ctx.db
        .select({
          id: arrets.id,
          orderIndex: arrets.orderIndex,
          type: arrets.type,
        })
        .from(arrets)
        .where(
          and(
            eq(arrets.trajetId, input.trajetId),
            eq(arrets.tenantId, ctx.tenantId),
            isNull(arrets.deletedAt),
          ),
        )
        .orderBy(asc(arrets.orderIndex));

      // Logical placement by direction:
      // - "aller": school is the destination (last) → insert new usager stops just before it.
      // - "retour": school is the origin (first) → append new stops at the end.
      const maxIndex = existing.reduce((m, a) => Math.max(m, a.orderIndex), -1);
      const ecole = existing.find((a) => a.type === "etablissement");
      const insertPos =
        input.data.type === "usager" &&
        trajet[0]!.direction === "aller" &&
        ecole
          ? ecole.orderIndex
          : maxIndex + 1;

      const result = await ctx.db.transaction(async (tx) => {
        // Make room: shift every stop at/after the insertion point.
        for (const a of existing) {
          if (a.orderIndex >= insertPos) {
            await tx
              .update(arrets)
              .set({ orderIndex: a.orderIndex + 1, updatedAt: new Date() })
              .where(
                and(
                  eq(arrets.id, a.id),
                  eq(arrets.tenantId, ctx.tenantId),
                ),
              );
          }
        }

        return tx
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
            orderIndex: insertPos,
            arrivalTime: input.data.arrivalTime || null,
            waitTime: input.data.waitTime ?? null,
            distanceKm: input.data.distanceKm ?? null,
            durationSeconds: input.data.durationSeconds ?? null,
            timeLocked: input.data.timeLocked ?? false,
          })
          .returning();
      });

      return result[0];
    }),

  reorder: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        items: z.array(
          z.object({
            id: z.string().uuid(),
            orderIndex: z.number().int().min(0),
          }),
        ),
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

      await ctx.db.transaction(async (tx) => {
        for (const item of input.items) {
          await tx
            .update(arrets)
            .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
            .where(
              and(
                eq(arrets.id, item.id),
                eq(arrets.trajetId, input.trajetId),
                eq(arrets.tenantId, ctx.tenantId),
              ),
            );
        }
      });

      return { updated: input.items.length };
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
          distanceKm: input.data.distanceKm ?? null,
          durationSeconds: input.data.durationSeconds ?? null,
          timeLocked: input.data.timeLocked ?? false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.trajetId, input.trajetId),
            eq(arrets.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  toggleTimeLock: tenantProcedure
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

      const current = await ctx.db
        .select({ timeLocked: arrets.timeLocked })
        .from(arrets)
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.trajetId, input.trajetId),
            eq(arrets.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      if (current.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arret non trouve" });
      }

      const result = await ctx.db
        .update(arrets)
        .set({
          timeLocked: !current[0]!.timeLocked,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.trajetId, input.trajetId),
            eq(arrets.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  setArrivalTime: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        trajetId: z.string().uuid(),
        arrivalTime: z.string().nullable(),
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
        .set({ arrivalTime: input.arrivalTime || null, updatedAt: new Date() })
        .where(
          and(
            eq(arrets.id, input.id),
            eq(arrets.trajetId, input.trajetId),
            eq(arrets.tenantId, ctx.tenantId),
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
            eq(arrets.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

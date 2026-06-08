import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { etablissements, arrets, circuits, trajets } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  etablissementSchema,
  etablissementDetailSchema,
  schedulesSchema,
} from "@/lib/validators/etablissement";
import {
  resolveScheduleAnchor,
  type EtablissementSchedules,
} from "../services/trajet-sync";
import { normalizeDays } from "@/lib/types/day-entry";

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

  deleteMany: tenantProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { deleted: 0 };

      const result = await ctx.db
        .update(etablissements)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(etablissements.tenantId, ctx.tenantId),
            inArray(etablissements.id, input.ids),
            isNull(etablissements.deletedAt),
          ),
        )
        .returning({ id: etablissements.id });

      return { deleted: result.length };
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
      // Coordonnées avant modification, pour détecter un changement de géoloc.
      const beforeRows = await ctx.db
        .select({
          latitude: etablissements.latitude,
          longitude: etablissements.longitude,
        })
        .from(etablissements)
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .limit(1);
      const before = beforeRows[0];

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
              eq(arrets.tenantId, ctx.tenantId),
              isNull(arrets.deletedAt),
            ),
          );
      }

      // Si la géolocalisation a changé, le calcul itinéraire/horaires des
      // trajets des circuits liés n'est plus valide : on le réinitialise pour
      // forcer un recalcul (l'état « OK » ne reposant que sur ces champs).
      const coordsChanged =
        !!updated &&
        (before?.latitude !== updated.latitude ||
          before?.longitude !== updated.longitude);

      if (updated && coordsChanged) {
        const circuitRows = await ctx.db
          .select({ id: circuits.id })
          .from(circuits)
          .where(
            and(
              eq(circuits.etablissementId, updated.id),
              eq(circuits.tenantId, ctx.tenantId),
            ),
          );
        const circuitIds = circuitRows.map((c) => c.id);

        if (circuitIds.length > 0) {
          const trajetRows = await ctx.db
            .select({ id: trajets.id })
            .from(trajets)
            .where(
              and(
                inArray(trajets.circuitId, circuitIds),
                eq(trajets.tenantId, ctx.tenantId),
                isNull(trajets.deletedAt),
              ),
            );
          const trajetIds = trajetRows.map((t) => t.id);

          if (trajetIds.length > 0) {
            // Réinitialise km / temps / tracé du trajet.
            await ctx.db
              .update(trajets)
              .set({
                routeGeometry: null,
                totalDistanceKm: null,
                totalDurationSeconds: null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  inArray(trajets.id, trajetIds),
                  eq(trajets.tenantId, ctx.tenantId),
                ),
              );
            // Réinitialise les horaires de PEC des arrêts (hors verrouillés).
            await ctx.db
              .update(arrets)
              .set({ arrivalTime: null, updatedAt: new Date() })
              .where(
                and(
                  inArray(arrets.trajetId, trajetIds),
                  eq(arrets.tenantId, ctx.tenantId),
                  eq(arrets.timeLocked, false),
                  isNull(arrets.deletedAt),
                ),
              );
          }
        }
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
      // Horaires avant modification, pour détecter un vrai changement.
      const beforeRows = await ctx.db
        .select({ schedules: etablissements.schedules })
        .from(etablissements)
        .where(
          and(
            eq(etablissements.id, input.id),
            eq(etablissements.tenantId, ctx.tenantId),
            isNull(etablissements.deletedAt),
          ),
        )
        .limit(1);
      const before = beforeRows[0];

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

      const updated = result[0];

      // Si les horaires de l'établissement changent, les horaires de PEC des
      // trajets des circuits liés ne sont plus valides : on les réinitialise
      // (sauf arrêts à horaire verrouillé manuellement) pour forcer un recalcul.
      const schedulesChanged =
        !!updated &&
        JSON.stringify(before?.schedules ?? null) !==
          JSON.stringify(input.schedules ?? null);

      if (updated && schedulesChanged) {
        const circuitRows = await ctx.db
          .select({ id: circuits.id })
          .from(circuits)
          .where(
            and(
              eq(circuits.etablissementId, updated.id),
              eq(circuits.tenantId, ctx.tenantId),
            ),
          );
        const circuitIds = circuitRows.map((c) => c.id);

        if (circuitIds.length > 0) {
          const trajetRows = await ctx.db
            .select({
              id: trajets.id,
              direction: trajets.direction,
              recurrence: trajets.recurrence,
            })
            .from(trajets)
            .where(
              and(
                inArray(trajets.circuitId, circuitIds),
                eq(trajets.tenantId, ctx.tenantId),
                isNull(trajets.deletedAt),
              ),
            );
          const trajetIds = trajetRows.map((t) => t.id);

          if (trajetIds.length > 0) {
            // Re-ancre chaque trajet sur l'horaire de l'établissement
            // (matin pour un aller, soir pour un retour).
            for (const t of trajetRows) {
              const rec = t.recurrence as { daysOfWeek?: unknown } | null;
              const anchor = resolveScheduleAnchor(
                input.schedules as EtablissementSchedules,
                t.direction,
                normalizeDays(rec?.daysOfWeek),
              );
              await ctx.db
                .update(trajets)
                .set({ departureTime: anchor, updatedAt: new Date() })
                .where(
                  and(
                    eq(trajets.id, t.id),
                    eq(trajets.tenantId, ctx.tenantId),
                  ),
                );
              // Arrêt établissement = ancre verrouillée (horaire école).
              await ctx.db
                .update(arrets)
                .set({
                  arrivalTime: anchor,
                  timeLocked: anchor != null,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(arrets.trajetId, t.id),
                    eq(arrets.type, "etablissement"),
                    eq(arrets.tenantId, ctx.tenantId),
                    isNull(arrets.deletedAt),
                  ),
                );
            }
            // Invalide les horaires de PEC calculés (hors verrouillés) :
            // ils seront recalculés à partir de la nouvelle ancre.
            await ctx.db
              .update(arrets)
              .set({ arrivalTime: null, updatedAt: new Date() })
              .where(
                and(
                  inArray(arrets.trajetId, trajetIds),
                  eq(arrets.tenantId, ctx.tenantId),
                  eq(arrets.timeLocked, false),
                  isNull(arrets.deletedAt),
                ),
              );
          }
        }
      }

      return result[0] ?? null;
    }),
});

import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  usagers,
  usagerAddresses,
  etablissements,
  tenantSettings,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { assertTenantOwned } from "../ownership";
import { usagerSchema, usagerDetailSchema } from "@/lib/validators/usager";
import { alias } from "drizzle-orm/pg-core";
import { nextDisplayId } from "@/lib/db/display-id";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../services/routing/resolve";

const secondaryEtab = alias(etablissements, "secondary_etab");

// Anti-IDOR: referenced établissements must belong to the tenant
async function assertEtabRefsOwned(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  data: { etablissementId?: string | null; secondaryEtablissementId?: string | null },
) {
  await Promise.all([
    data.etablissementId
      ? assertTenantOwned(ctx.db, etablissements, data.etablissementId, ctx.tenantId, "Etablissement")
      : null,
    data.secondaryEtablissementId
      ? assertTenantOwned(ctx.db, etablissements, data.secondaryEtablissementId, ctx.tenantId, "Etablissement")
      : null,
  ]);
}

export const usagersRouter = createTRPCRouter({
  // campaignId absent => production; provided => usagers of the preparation campaign.
  list: tenantProcedure
    .input(z.object({ campaignId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: usagers.id,
        displayId: usagers.displayId,
        code: usagers.code,
        firstName: usagers.firstName,
        lastName: usagers.lastName,
        birthDate: usagers.birthDate,
        gender: usagers.gender,
        status: usagers.status,
        regime: usagers.regime,
        etablissementId: usagers.etablissementId,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        secondaryEtablissementId: usagers.secondaryEtablissementId,
        secondaryEtablissementName: secondaryEtab.name,
        classe: usagers.classe,
        transportType: usagers.transportType,
        transportStartDate: usagers.transportStartDate,
        transportEndDate: usagers.transportEndDate,
        transportParticularity: usagers.transportParticularity,
        specificity: usagers.specificity,
        notes: usagers.notes,
        archivedAt: usagers.archivedAt,
        createdAt: usagers.createdAt,
        updatedAt: usagers.updatedAt,
      })
      .from(usagers)
      // Re-filter tenant on joins (anti-IDOR via injected FK)
      .leftJoin(
        etablissements,
        and(
          eq(usagers.etablissementId, etablissements.id),
          eq(etablissements.tenantId, ctx.tenantId),
        ),
      )
      .leftJoin(
        secondaryEtab,
        and(
          eq(usagers.secondaryEtablissementId, secondaryEtab.id),
          eq(secondaryEtab.tenantId, ctx.tenantId),
        ),
      )
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          isNull(usagers.deletedAt),
          input?.campaignId
            ? eq(usagers.preparationCampaignId, input.campaignId)
            : isNull(usagers.preparationCampaignId),
        ),
      );
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: usagers.id,
          displayId: usagers.displayId,
          code: usagers.code,
          firstName: usagers.firstName,
          lastName: usagers.lastName,
          birthDate: usagers.birthDate,
          gender: usagers.gender,
          status: usagers.status,
          regime: usagers.regime,
          etablissementId: usagers.etablissementId,
          etablissementName: etablissements.name,
          etablissementType: etablissements.type,
          secondaryEtablissementId: usagers.secondaryEtablissementId,
          secondaryEtablissementName: secondaryEtab.name,
          classe: usagers.classe,
          transportType: usagers.transportType,
          distanceKm: usagers.distanceKm,
          transportStartDate: usagers.transportStartDate,
          transportEndDate: usagers.transportEndDate,
          transportParticularity: usagers.transportParticularity,
          specificity: usagers.specificity,
          notes: usagers.notes,
          archivedAt: usagers.archivedAt,
          createdAt: usagers.createdAt,
          updatedAt: usagers.updatedAt,
        })
        .from(usagers)
        .leftJoin(
          etablissements,
          and(
            eq(usagers.etablissementId, etablissements.id),
            eq(etablissements.tenantId, ctx.tenantId),
          ),
        )
        .leftJoin(
          secondaryEtab,
          and(
            eq(usagers.secondaryEtablissementId, secondaryEtab.id),
            eq(secondaryEtab.tenantId, ctx.tenantId),
          ),
        )
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(usagerSchema)
    .mutation(async ({ ctx, input }) => {
      await assertEtabRefsOwned(ctx, input);

      // Fetch school year dates to pre-fill
      const settings = await ctx.db
        .select({
          schoolYearStart: tenantSettings.schoolYearStart,
          schoolYearEnd: tenantSettings.schoolYearEnd,
        })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, ctx.tenantId))
        .limit(1)
        .then((rows) => rows[0]);

      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "usagers");
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          etablissementId: input.etablissementId || null,
          transportStartDate: settings?.schoolYearStart ?? null,
          transportEndDate: settings?.schoolYearEnd ?? null,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(usagerDetailSchema)
    .mutation(async ({ ctx, input }) => {
      await assertEtabRefsOwned(ctx, input);
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "usagers");
      const result = await ctx.db
        .insert(usagers)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          code: input.code || null,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          status: input.status || "non_controle",
          regime: input.regime || null,
          etablissementId: input.etablissementId || null,
          secondaryEtablissementId: input.secondaryEtablissementId || null,
          classe: input.classe || null,
          transportType: input.transportType || null,
          distanceKm: input.distanceKm ?? null,
          transportStartDate: input.transportStartDate,
          transportEndDate: input.transportEndDate || null,
          transportParticularity: input.transportParticularity || null,
          specificity: input.specificity || null,
          notes: input.notes || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Échec de la création" });
      }
      return created;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: usagerSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEtabRefsOwned(ctx, input.data);
      const result = await ctx.db
        .update(usagers)
        .set({
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          birthDate: input.data.birthDate || null,
          gender: input.data.gender || null,
          etablissementId: input.data.etablissementId || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: usagerDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEtabRefsOwned(ctx, input.data);
      const result = await ctx.db
        .update(usagers)
        .set({
          code: input.data.code || null,
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          birthDate: input.data.birthDate || null,
          gender: input.data.gender || null,
          status: input.data.status || "non_controle",
          regime: input.data.regime || null,
          etablissementId: input.data.etablissementId || null,
          secondaryEtablissementId: input.data.secondaryEtablissementId || null,
          classe: input.data.classe || null,
          transportType: input.data.transportType || null,
          distanceKm: input.data.distanceKm ?? null,
          transportStartDate: input.data.transportStartDate,
          transportEndDate: input.data.transportEndDate || null,
          transportParticularity: input.data.transportParticularity || null,
          specificity: input.data.specificity || null,
          notes: input.data.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  // Bulk update of transport dates (start and/or end) on a selection of usagers.
  // An absent field (`undefined`) is not touched; provided as `null` it is
  // cleared; provided as a date it is set.
  updateTransportDatesMany: tenantProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1),
        transportStartDate: z.string().nullable().optional(),
        transportEndDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Nothing checked UI-side → no-op (the dialog already prevents this).
      if (
        input.transportStartDate === undefined &&
        input.transportEndDate === undefined
      ) {
        return { updated: 0 };
      }

      const patch: Partial<typeof usagers.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.transportStartDate !== undefined)
        patch.transportStartDate = input.transportStartDate;
      if (input.transportEndDate !== undefined)
        patch.transportEndDate = input.transportEndDate;

      const result = await ctx.db
        .update(usagers)
        .set(patch)
        .where(
          and(
            eq(usagers.tenantId, ctx.tenantId),
            inArray(usagers.id, input.ids),
            isNull(usagers.deletedAt),
          ),
        )
        .returning({ id: usagers.id });

      return { updated: result.length };
    }),

  // Computes the road distance between the usager's primary address (position 1)
  // and their primary établissement. Returns km without persisting:
  // the detail form is responsible for saving.
  computeDistance: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          etabLat: etablissements.latitude,
          etabLng: etablissements.longitude,
        })
        .from(usagers)
        .leftJoin(etablissements, eq(usagers.etablissementId, etablissements.id))
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usager non trouvé" });
      }
      if (row.etabLat == null || row.etabLng == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "L'établissement principal n'a pas de coordonnées géographiques.",
        });
      }

      const [addr] = await ctx.db
        .select({
          lat: usagerAddresses.latitude,
          lng: usagerAddresses.longitude,
        })
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.usagerId, input.id),
            eq(usagerAddresses.tenantId, ctx.tenantId),
            eq(usagerAddresses.position, 1),
          ),
        )
        .limit(1);

      if (!addr || addr.lat == null || addr.lng == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "L'adresse principale n'a pas de coordonnées (renseignez-la d'abord).",
        });
      }

      const routingConfig = await resolveRoutingConfig(ctx.db, ctx.tenantId);
      const outcome = await computeSegmentForTenant(
        { lat: addr.lat, lng: addr.lng },
        { lat: row.etabLat, lng: row.etabLng },
        routingConfig,
      );

      if (outcome.result == null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Calcul de distance indisponible (service de routing).",
        });
      }

      // Home↔school distance displayed to 0.1 km precision (as in legacy).
      const km = Math.round(outcome.result.distanceKm * 10) / 10;

      return { km };
    }),

  // Archiving / unarchiving (historization, distinct from deletion).
  setArchived: tenantProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagers)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .returning();
      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(usagers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(usagers.id, input.id),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
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
        .update(usagers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(usagers.tenantId, ctx.tenantId),
            inArray(usagers.id, input.ids),
            isNull(usagers.deletedAt),
          ),
        )
        .returning({ id: usagers.id });

      return { deleted: result.length };
    }),
});

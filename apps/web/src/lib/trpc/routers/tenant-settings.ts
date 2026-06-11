import { z } from "zod";
import { eq } from "drizzle-orm";
import { tenants, tenantSettings } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "../init";
import {
  upsertProviderKey,
  getProviderKeyStatus,
} from "../services/provider-keys";
import {
  resolveRoutingConfig,
  computeSegmentForTenant,
} from "../services/routing/resolve";

const routingProviders = ["osrm", "ign", "openrouteservice", "google"] as const;
const basemapProviders = [
  "openfreemap",
  "osm_raster",
  "maptiler",
  "ign",
] as const;

const tenantSettingsSchema = z.object({
  schoolYearStart: z.string().nullable(),
  schoolYearEnd: z.string().nullable(),
  routingProvider: z.enum(routingProviders),
  basemapProvider: z.enum(basemapProviders),
  basemapStyle: z.string().max(64).nullable(),
});

const setProviderKeySchema = z.object({
  category: z.enum(["routing", "basemap"]),
  provider: z.string().max(32),
  apiKey: z.string().min(1),
});

const DEFAULTS = {
  schoolYearStart: null as string | null,
  schoolYearEnd: null as string | null,
  routingProvider: "ign" as (typeof routingProviders)[number],
  basemapProvider: "openfreemap" as (typeof basemapProviders)[number],
  basemapStyle: null as string | null,
};

const tenantTypes = ["departement", "transporteur"] as const;
export type TenantType = (typeof tenantTypes)[number];

export const tenantSettingsRouter = createTRPCRouter({
  get: tenantProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: tenantSettings.id,
        schoolYearStart: tenantSettings.schoolYearStart,
        schoolYearEnd: tenantSettings.schoolYearEnd,
        routingProvider: tenantSettings.routingProvider,
        basemapProvider: tenantSettings.basemapProvider,
        basemapStyle: tenantSettings.basemapStyle,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, ctx.tenantId))
      .limit(1);

    const tenant = await ctx.db
      .select({ type: tenants.type })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    // Présence/masque des clés (jamais la clé en clair).
    const keyStatus = await getProviderKeyStatus(ctx.db, ctx.tenantId);

    return {
      ...DEFAULTS,
      ...(result[0] ?? {}),
      keyStatus,
      tenantType: (tenant[0]?.type ?? "departement") as TenantType,
    };
  }),

  /** Profil métier du client (département / transporteur). */
  setType: adminProcedure
    .input(z.object({ type: z.enum(tenantTypes) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tenants)
        .set({ type: input.type, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.tenantId));
      return { ok: true };
    }),

  update: adminProcedure
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
            routingProvider: input.routingProvider,
            basemapProvider: input.basemapProvider,
            basemapStyle: input.basemapStyle,
            updatedAt: new Date(),
          })
          .where(eq(tenantSettings.tenantId, ctx.tenantId))
          .returning({ id: tenantSettings.id });

        return result[0] ?? null;
      }

      const result = await ctx.db
        .insert(tenantSettings)
        .values({
          tenantId: ctx.tenantId,
          schoolYearStart: input.schoolYearStart,
          schoolYearEnd: input.schoolYearEnd,
          routingProvider: input.routingProvider,
          basemapProvider: input.basemapProvider,
          basemapStyle: input.basemapStyle,
        })
        .returning({ id: tenantSettings.id });

      return result[0] ?? null;
    }),

  /** Enregistre (chiffrée) la clé d'API d'un provider. Écriture seule : jamais relue. */
  setProviderKey: adminProcedure
    .input(setProviderKeySchema)
    .mutation(async ({ ctx, input }) => {
      await upsertProviderKey(
        ctx.db,
        ctx.tenantId,
        input.category,
        input.provider,
        input.apiKey,
      );
      return { ok: true };
    }),

  /** Teste le moteur de routing configuré sur un court trajet parisien. */
  testRouting: tenantProcedure.mutation(async ({ ctx }) => {
    const cfg = await resolveRoutingConfig(ctx.db, ctx.tenantId);
    const outcome = await computeSegmentForTenant(
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8606, lng: 2.3376 },
      cfg,
    );
    return {
      ok: outcome.result != null,
      providerUsed: outcome.providerUsed,
      distanceKm: outcome.result?.distanceKm ?? null,
    };
  }),
});

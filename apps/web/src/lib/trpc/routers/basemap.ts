import { eq } from "drizzle-orm";
import { tenantSettings } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import { buildBasemapStyle } from "@/lib/maps/build-basemap";
import { getProviderKeyStatus } from "../services/provider-keys";

export const basemapRouter = createTRPCRouter({
  /**
   * Renvoie la spécification de fond de carte du tenant (style URL ou style
   * raster inline). Replie sur OpenFreeMap si MapTiler est choisi sans clé,
   * pour éviter une carte cassée.
   */
  getStyle: tenantProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({
        provider: tenantSettings.basemapProvider,
        style: tenantSettings.basemapStyle,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, ctx.tenantId))
      .limit(1);

    const provider = row[0]?.provider ?? "openfreemap";
    const style = row[0]?.style ?? null;

    if (provider === "maptiler") {
      const status = await getProviderKeyStatus(ctx.db, ctx.tenantId);
      if (!status.maptiler) {
        return buildBasemapStyle("openfreemap", null);
      }
    }

    return buildBasemapStyle(provider, style);
  }),
});

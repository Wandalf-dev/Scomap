/**
 * Orchestrateur de routing par tenant : lit le provider configuré, déchiffre
 * sa clé une seule fois, puis calcule des segments avec repli sur OSRM.
 *
 * ⚠️ Server-only.
 */

import { eq } from "drizzle-orm";
import { tenantSettings } from "@scomap/db/schema";
import type { Database } from "@scomap/db";
import { routingAdapters } from "./registry";
import { getDecryptedKey } from "../provider-keys";
import type {
  LatLng,
  RouteResult,
  RoutingAdapter,
  RoutingProviderId,
} from "./types";

export interface RoutingConfig {
  adapter: RoutingAdapter;
  apiKey?: string;
}

export interface SegmentOutcome {
  result: RouteResult | null;
  /** Provider réellement utilisé (peut différer en cas de repli OSRM). */
  providerUsed: RoutingProviderId;
}

/**
 * Résout l'adaptateur et la clé pour un tenant. À appeler UNE fois avant une
 * boucle de segments (la clé n'est déchiffrée qu'ici).
 */
export async function resolveRoutingConfig(
  db: Database,
  tenantId: string,
): Promise<RoutingConfig> {
  const row = await db
    .select({ provider: tenantSettings.routingProvider })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const provider = (row[0]?.provider ?? "ign") as RoutingProviderId;
  const adapter = routingAdapters[provider] ?? routingAdapters.ign;
  const apiKey = adapter.requiresKey
    ? await getDecryptedKey(db, tenantId, "routing", adapter.id)
    : undefined;

  return { adapter, apiKey };
}

/**
 * Calcule un segment avec le provider du tenant, et repli sur OSRM si le
 * provider principal échoue. Renvoie `providerUsed` pour éviter le faux
 * positif « je crois utiliser Google ».
 */
export async function computeSegmentForTenant(
  from: LatLng,
  to: LatLng,
  cfg: RoutingConfig,
  avoidTolls = false,
): Promise<SegmentOutcome> {
  const primary = await cfg.adapter.computeSegment(from, to, {
    apiKey: cfg.apiKey,
    avoidTolls,
    signal: AbortSignal.timeout(30_000),
  });
  if (primary) return { result: primary, providerUsed: cfg.adapter.id };

  if (cfg.adapter.id !== "osrm") {
    const fallback = await routingAdapters.osrm.computeSegment(from, to, {
      avoidTolls,
      signal: AbortSignal.timeout(8_000),
    });
    if (fallback) return { result: fallback, providerUsed: "osrm" };
  }

  return { result: null, providerUsed: cfg.adapter.id };
}

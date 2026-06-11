/**
 * Per-tenant routing orchestrator: reads the configured provider, decrypts
 * its key once, then computes segments with OSRM fallback.
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
  /** Provider actually used (may differ when falling back to OSRM). */
  providerUsed: RoutingProviderId;
}

/**
 * Resolves the adapter and key for a tenant. Call ONCE before a segment loop
 * (the key is only decrypted here).
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
 * Computes a segment with the tenant's provider, falling back to OSRM if the
 * primary provider fails. Returns `providerUsed` to avoid the false positive
 * "I think I'm using Google".
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

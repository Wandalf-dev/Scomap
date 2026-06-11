/**
 * Access to provider API keys, encrypted per tenant.
 *
 * ⚠️ Server-only: decrypts secrets. Never import client-side.
 * Hard rule: these helpers NEVER return `ciphertext` or a plain-text key
 * to the UI (except `getProviderKeyStatus` which only exposes `lastFour`).
 */

import { and, eq } from "drizzle-orm";
import { tenantProviderKeys } from "@scomap/db/schema";
import type { Database } from "@scomap/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";

export type ProviderCategory = "routing" | "basemap";

/** Creates or updates the encrypted key of a provider for a tenant. */
export async function upsertProviderKey(
  db: Database,
  tenantId: string,
  category: ProviderCategory,
  provider: string,
  plainKey: string,
): Promise<void> {
  const ciphertext = encryptSecret(plainKey);
  const lastFour = plainKey.slice(-4);
  await db
    .insert(tenantProviderKeys)
    .values({ tenantId, category, provider, ciphertext, lastFour })
    .onConflictDoUpdate({
      target: [
        tenantProviderKeys.tenantId,
        tenantProviderKeys.category,
        tenantProviderKeys.provider,
      ],
      set: { ciphertext, lastFour, updatedAt: new Date() },
    });
}

/**
 * Returns the decrypted key, or `undefined` if absent OR if decryption
 * fails (e.g. AUTH_SECRET rotation). In that case the provider falls back to
 * "key absent" rather than crashing.
 */
export async function getDecryptedKey(
  db: Database,
  tenantId: string,
  category: ProviderCategory,
  provider: string,
): Promise<string | undefined> {
  const row = await db
    .select({ ciphertext: tenantProviderKeys.ciphertext })
    .from(tenantProviderKeys)
    .where(
      and(
        eq(tenantProviderKeys.tenantId, tenantId),
        eq(tenantProviderKeys.category, category),
        eq(tenantProviderKeys.provider, provider),
      ),
    )
    .limit(1);
  if (!row[0]) return undefined;
  try {
    return decryptSecret(row[0].ciphertext);
  } catch {
    return undefined;
  }
}

/** For the UI: presence + last 4 characters of each key. Never the key itself. */
export async function getProviderKeyStatus(
  db: Database,
  tenantId: string,
): Promise<Record<string, string | null>> {
  const rows = await db
    .select({
      provider: tenantProviderKeys.provider,
      lastFour: tenantProviderKeys.lastFour,
    })
    .from(tenantProviderKeys)
    .where(eq(tenantProviderKeys.tenantId, tenantId));
  return Object.fromEntries(rows.map((r) => [r.provider, r.lastFour ?? null]));
}

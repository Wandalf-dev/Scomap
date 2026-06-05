/**
 * Accès aux clés d'API des providers, chiffrées par tenant.
 *
 * ⚠️ Server-only : déchiffre des secrets. Ne jamais importer côté client.
 * Règle dure : ces helpers ne renvoient JAMAIS de `ciphertext` ni de clé en
 * clair vers l'UI (sauf `getProviderKeyStatus` qui ne sort que `lastFour`).
 */

import { and, eq } from "drizzle-orm";
import { tenantProviderKeys } from "@scomap/db/schema";
import type { Database } from "@scomap/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";

export type ProviderCategory = "routing" | "basemap";

/** Crée ou met à jour la clé chiffrée d'un provider pour un tenant. */
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
 * Renvoie la clé déchiffrée, ou `undefined` si absente OU si le déchiffrement
 * échoue (ex. rotation d'AUTH_SECRET). Dans ce cas le provider tombe en
 * « clé absente » plutôt que de crasher.
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

/** Pour l'UI : présence + 4 derniers caractères de chaque clé. Jamais la clé. */
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

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/** Catégorie de provider à laquelle se rattache une clé d'API. */
export const providerCategoryEnum = pgEnum("provider_category", [
  "routing",
  "basemap",
]);

/**
 * Clés d'API des providers (routing/basemap) par tenant, chiffrées au repos.
 *
 * Table SÉPARÉE de `tenant_settings` : aucune requête métier sur les réglages
 * ne doit jamais ramener de `ciphertext` au client. Les clés ne sortent d'ici
 * que déchiffrées côté serveur (jamais renvoyées à l'UI), sauf `lastFour` pour
 * l'affichage masqué.
 */
export const tenantProviderKeys = pgTable(
  "tenant_provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    category: providerCategoryEnum("category").notNull(),
    // "openrouteservice" | "google" | "maptiler" ...
    provider: varchar("provider", { length: 32 }).notNull(),
    // Composite AES-256-GCM : "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
    ciphertext: text("ciphertext").notNull(),
    // Version de la clé maître (pour une éventuelle rotation d'AUTH_SECRET).
    keyVersion: integer("key_version").notNull().default(1),
    // 4 derniers caractères pour l'affichage "••••Ab3f" — jamais la clé entière.
    lastFour: varchar("last_four", { length: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tenant_provider_keys_uq").on(
      t.tenantId,
      t.category,
      t.provider,
    ),
  ],
);

export type TenantProviderKey = typeof tenantProviderKeys.$inferSelect;
export type NewTenantProviderKey = typeof tenantProviderKeys.$inferInsert;

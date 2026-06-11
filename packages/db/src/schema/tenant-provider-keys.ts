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

/** Provider category to which an API key belongs. */
export const providerCategoryEnum = pgEnum("provider_category", [
  "routing",
  "basemap",
]);

/**
 * Provider API keys (routing/basemap) per tenant, encrypted at rest.
 *
 * SEPARATE table from `tenant_settings`: no business query on settings
 * should ever return `ciphertext` to the client. Keys only leave here
 * decrypted server-side (never sent to the UI), except `lastFour` for
 * masked display.
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
    // Master key version (for a potential AUTH_SECRET rotation).
    keyVersion: integer("key_version").notNull().default(1),
    // Last 4 characters for "••••Ab3f" display — never the full key.
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

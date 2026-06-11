import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/** Routing engine (distance + path) chosen by the tenant. */
export const routingProviderEnum = pgEnum("routing_provider", [
  "osrm", // public/self-hosted, no key required
  "ign", // IGN Géoplateforme, no key required (= legacy trajet behaviour)
  "openrouteservice", // key required
  "google", // key required
]);

/** Basemap provider chosen by the tenant. */
export const basemapProviderEnum = pgEnum("basemap_provider", [
  "openfreemap", // vector, no key required (historical default)
  "osm_raster", // OSM raster tiles, no key required
  "maptiler", // key required -> server proxy
  "ign", // IGN Plan/Photo (WMTS), no key required
]);

export const tenantSettings = pgTable("tenant_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  schoolYearStart: date("school_year_start"),
  schoolYearEnd: date("school_year_end"),
  // --- Setting A: routing engine ---
  routingProvider: routingProviderEnum("routing_provider")
    .notNull()
    .default("ign"),
  // --- Setting B: basemap ---
  basemapProvider: basemapProviderEnum("basemap_provider")
    .notNull()
    .default("openfreemap"),
  // Provider-dependent style identifier: "liberty" | "streets-v2" |
  // "GEOGRAPHICALGRIDSYSTEMS.PLAN.IGN" ...
  basemapStyle: varchar("basemap_style", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TenantSettings = typeof tenantSettings.$inferSelect;
export type NewTenantSettings = typeof tenantSettings.$inferInsert;

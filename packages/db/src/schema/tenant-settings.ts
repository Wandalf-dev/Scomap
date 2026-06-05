import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/** Moteur de calcul d'itinéraire (distance + tracé) choisi par le tenant. */
export const routingProviderEnum = pgEnum("routing_provider", [
  "osrm", // public/auto-hébergé, pas de clé
  "ign", // IGN Géoplateforme, pas de clé (= comportement historique des trajets)
  "openrouteservice", // clé requise
  "google", // clé requise
]);

/** Fond de carte choisi par le tenant. */
export const basemapProviderEnum = pgEnum("basemap_provider", [
  "openfreemap", // vecteur, pas de clé (défaut historique)
  "osm_raster", // tuiles raster OSM, pas de clé
  "maptiler", // clé requise -> proxy serveur
  "ign", // IGN Plan/Photo (WMTS), pas de clé
]);

export const tenantSettings = pgTable("tenant_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  schoolYearStart: date("school_year_start"),
  schoolYearEnd: date("school_year_end"),
  // --- Réglage A : moteur de routing ---
  routingProvider: routingProviderEnum("routing_provider")
    .notNull()
    .default("ign"),
  // --- Réglage B : fond de carte ---
  basemapProvider: basemapProviderEnum("basemap_provider")
    .notNull()
    .default("openfreemap"),
  // Identifiant de style dépendant du provider : "liberty" | "streets-v2" |
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

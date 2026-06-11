import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  doublePrecision,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { circuits } from "./circuits";
import { chauffeurs } from "./chauffeurs";
import { vehicules } from "./vehicules";
import { usagerAddresses } from "./usager-addresses";
import { etablissements } from "./etablissements";

export const trajets = pgTable("trajets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  // Sequential human-readable number per tenant (Transcolaire-style), distinct from the UUID.
  displayId: integer("display_id").notNull(),
  circuitId: uuid("circuit_id")
    .notNull()
    .references(() => circuits.id, { onDelete: "cascade" }),
  // Avenant that created this trajet (FK defined in SQL to avoid a schema
  // import cycle trajets <-> avenants). Null if direct association.
  createdByAvenantId: uuid("created_by_avenant_id"),
  chauffeurId: uuid("chauffeur_id").references(() => chauffeurs.id, {
    onDelete: "set null",
  }),
  vehiculeId: uuid("vehicule_id").references(() => vehicules.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // 'aller' | 'retour'
  departureTime: varchar("departure_time", { length: 5 }), // HH:MM
  recurrence: jsonb("recurrence").$type<{
    frequency: "weekly";
    daysOfWeek: number[] | { day: number; parity: "all" | "even" | "odd" }[];
  }>(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  etat: varchar("etat", { length: 20 }),
  peages: boolean("peages").notNull().default(false),
  kmACharge: doublePrecision("km_a_charge"),
  totalDistanceKm: doublePrecision("total_distance_km"),
  totalDurationSeconds: integer("total_duration_seconds"),
  routeGeometry: jsonb("route_geometry").$type<{
    type: "LineString";
    coordinates: number[][];
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Back-to-school preparation: null = production, otherwise a draft copy linked to a campaign.
  preparationCampaignId: uuid("preparation_campaign_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("trajets_tenant_display_id_idx").on(t.tenantId, t.displayId),
]);

export const trajetOccurrences = pgTable(
  "trajet_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    trajetId: uuid("trajet_id")
      .notNull()
      .references(() => trajets.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("planifie"), // planifie | en_cours | termine | annule
    chauffeurId: uuid("chauffeur_id").references(() => chauffeurs.id, {
      onDelete: "set null",
    }),
    vehiculeId: uuid("vehicule_id").references(() => vehicules.id, {
      onDelete: "set null",
    }),
    departureTime: varchar("departure_time", { length: 5 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("trajet_occurrences_trajet_date_idx").on(
      table.trajetId,
      table.date,
    ),
    index("trajet_occurrences_date_idx").on(table.date),
  ],
);

export const arrets = pgTable("arrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  trajetId: uuid("trajet_id")
    .notNull()
    .references(() => trajets.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // 'usager' | 'etablissement'
  usagerAddressId: uuid("usager_address_id").references(
    () => usagerAddresses.id,
    { onDelete: "set null" },
  ),
  etablissementId: uuid("etablissement_id").references(
    () => etablissements.id,
    { onDelete: "set null" },
  ),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  orderIndex: integer("order_index").notNull(),
  arrivalTime: varchar("arrival_time", { length: 5 }), // HH:MM format
  waitTime: integer("wait_time"), // in minutes
  distanceKm: doublePrecision("distance_km"),
  durationSeconds: integer("duration_seconds"),
  timeLocked: boolean("time_locked").notNull().default(false),
  // Usager presence window on this trajet (resolved by avenant date).
  // null/null = always active (unbounded arrêt).
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Back-to-school preparation: null = production, otherwise a draft copy linked to a campaign.
  preparationCampaignId: uuid("preparation_campaign_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Trajet = typeof trajets.$inferSelect;
export type NewTrajet = typeof trajets.$inferInsert;
export type TrajetOccurrence = typeof trajetOccurrences.$inferSelect;
export type NewTrajetOccurrence = typeof trajetOccurrences.$inferInsert;
export type Arret = typeof arrets.$inferSelect;
export type NewArret = typeof arrets.$inferInsert;

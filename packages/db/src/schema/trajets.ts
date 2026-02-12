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
  circuitId: uuid("circuit_id")
    .notNull()
    .references(() => circuits.id, { onDelete: "cascade" }),
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
    daysOfWeek: number[];
  }>(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Trajet = typeof trajets.$inferSelect;
export type NewTrajet = typeof trajets.$inferInsert;
export type TrajetOccurrence = typeof trajetOccurrences.$inferSelect;
export type NewTrajetOccurrence = typeof trajetOccurrences.$inferInsert;
export type Arret = typeof arrets.$inferSelect;
export type NewArret = typeof arrets.$inferInsert;

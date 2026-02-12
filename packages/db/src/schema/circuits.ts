import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { usagerAddresses } from "./usager-addresses";
import { etablissements } from "./etablissements";

export const circuits = pgTable("circuits", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  // Days of operation (bitmask or array)
  operatingDays: jsonb("operating_days"), // e.g., [1,2,3,4,5] for weekdays
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const arrets = pgTable("arrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  circuitId: uuid("circuit_id")
    .notNull()
    .references(() => circuits.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }), // 'usager' | 'etablissement'
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
});

export type Circuit = typeof circuits.$inferSelect;
export type NewCircuit = typeof circuits.$inferInsert;
export type Arret = typeof arrets.$inferSelect;
export type NewArret = typeof arrets.$inferInsert;

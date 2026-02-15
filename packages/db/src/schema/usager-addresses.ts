import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { usagers } from "./usagers";

export const usagerAddresses = pgTable("usager_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  usagerId: uuid("usager_id")
    .notNull()
    .references(() => usagers.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(1),
  type: varchar("type", { length: 30 }),
  civility: varchar("civility", { length: 5 }),
  responsibleLastName: varchar("responsible_last_name", { length: 100 }),
  responsibleFirstName: varchar("responsible_first_name", { length: 100 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 10 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: varchar("phone", { length: 20 }),
  mobile: varchar("mobile", { length: 20 }),
  secondaryPhone: varchar("secondary_phone", { length: 20 }),
  secondaryMobile: varchar("secondary_mobile", { length: 20 }),
  email: varchar("email", { length: 255 }),
  authorizedPerson: varchar("authorized_person", { length: 200 }),
  transportType: varchar("transport_type", { length: 30 }),
  observations: text("observations"),
  daysAller: jsonb("days_aller").$type<
    number[] | { day: number; parity: "all" | "even" | "odd" }[]
  >(),
  daysRetour: jsonb("days_retour").$type<
    number[] | { day: number; parity: "all" | "even" | "odd" }[]
  >(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UsagerAddress = typeof usagerAddresses.$inferSelect;
export type NewUsagerAddress = typeof usagerAddresses.$inferInsert;

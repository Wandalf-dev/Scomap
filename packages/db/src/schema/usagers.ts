import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { etablissements } from "./etablissements";

export const usagers = pgTable("usagers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  etablissementId: uuid("etablissement_id").references(
    () => etablissements.id,
    { onDelete: "set null" }
  ),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  birthDate: date("birth_date"),
  // Up to 4 addresses (JSON array with address, lat, lng)
  addresses: jsonb("addresses"),
  parentName: varchar("parent_name", { length: 255 }),
  parentPhone: varchar("parent_phone", { length: 20 }),
  parentEmail: varchar("parent_email", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Usager = typeof usagers.$inferSelect;
export type NewUsager = typeof usagers.$inferInsert;

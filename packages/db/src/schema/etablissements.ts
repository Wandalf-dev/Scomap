import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const etablissements = pgTable("etablissements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }), // ecole, college, lycee, etc.
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 10 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  regime: varchar("regime", { length: 10 }), // public, prive
  color: varchar("color", { length: 7 }), // Couleur hex (#FF5733)
  website: varchar("website", { length: 255 }),
  managerCivility: varchar("manager_civility", { length: 5 }), // M., Mme
  managerName: varchar("manager_name", { length: 255 }),
  managerPhone: varchar("manager_phone", { length: 20 }),
  managerEmail: varchar("manager_email", { length: 255 }),
  codeUai: varchar("code_uai", { length: 20 }),
  observations: text("observations"),
  schedules: jsonb("schedules"), // Horaires par jour
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Etablissement = typeof etablissements.$inferSelect;
export type NewEtablissement = typeof etablissements.$inferInsert;

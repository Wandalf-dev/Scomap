import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  date,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const vehicules = pgTable("vehicules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  licensePlate: varchar("license_plate", { length: 20 }),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  year: integer("year"),
  capacity: integer("capacity"), // Number of passengers
  wheelchairAccessible: boolean("wheelchair_accessible").default(false),
  insuranceExpiry: date("insurance_expiry"),
  technicalControlExpiry: date("technical_control_expiry"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Vehicule = typeof vehicules.$inferSelect;
export type NewVehicule = typeof vehicules.$inferInsert;

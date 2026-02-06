import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const chauffeurs = pgTable("chauffeurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  licenseNumber: varchar("license_number", { length: 50 }),
  licenseExpiry: date("license_expiry"),
  medicalCertificateExpiry: date("medical_certificate_expiry"),
  hireDate: date("hire_date"),
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

export type Chauffeur = typeof chauffeurs.$inferSelect;
export type NewChauffeur = typeof chauffeurs.$inferInsert;

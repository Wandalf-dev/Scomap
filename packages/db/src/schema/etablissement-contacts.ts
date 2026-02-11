import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { etablissements } from "./etablissements";

export const etablissementContacts = pgTable("etablissement_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissementId: uuid("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  civility: varchar("civility", { length: 5 }), // M., Mme
  lastName: varchar("last_name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  function: varchar("function", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  observations: text("observations"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EtablissementContact = typeof etablissementContacts.$inferSelect;
export type NewEtablissementContact = typeof etablissementContacts.$inferInsert;

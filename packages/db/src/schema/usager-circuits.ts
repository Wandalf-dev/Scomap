import {
  pgTable,
  uuid,
  timestamp,
  date,
  jsonb,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { usagers } from "./usagers";
import { circuits } from "./circuits";
import { usagerAddresses } from "./usager-addresses";

export const usagerCircuits = pgTable(
  "usager_circuits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    usagerId: uuid("usager_id")
      .notNull()
      .references(() => usagers.id, { onDelete: "cascade" }),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    usagerAddressId: uuid("usager_address_id").references(
      () => usagerAddresses.id,
      { onDelete: "set null" },
    ),
    daysAller: jsonb("days_aller").$type<
      number[] | { day: number; parity: "all" | "even" | "odd" }[]
    >(),
    daysRetour: jsonb("days_retour").$type<
      number[] | { day: number; parity: "all" | "even" | "odd" }[]
    >(),
    arrivalNotification: boolean("arrival_notification").notNull().default(false),
    authorizationAlone: boolean("authorization_alone").notNull().default(false),
    // Plage de validité (résolution par date des avenants).
    // valid_from null = depuis toujours ; valid_to null = version courante.
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Une seule version OUVERTE (valid_to null) par couple usager/circuit.
    uniqueIndex("usager_circuits_open_version_idx")
      .on(table.usagerId, table.circuitId)
      .where(sql`${table.validTo} is null and ${table.deletedAt} is null`),
  ],
);

export type UsagerCircuit = typeof usagerCircuits.$inferSelect;
export type NewUsagerCircuit = typeof usagerCircuits.$inferInsert;

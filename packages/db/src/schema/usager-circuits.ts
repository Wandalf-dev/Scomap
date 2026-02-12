import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("usager_circuits_usager_circuit_idx").on(
      table.usagerId,
      table.circuitId,
    ),
  ],
);

export type UsagerCircuit = typeof usagerCircuits.$inferSelect;
export type NewUsagerCircuit = typeof usagerCircuits.$inferInsert;

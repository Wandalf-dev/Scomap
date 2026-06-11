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
    // Validity range (resolved by avenant date).
    // valid_from null = since forever; valid_to null = current version.
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    // Avenant that created this assignment version (FK defined in SQL to avoid
    // a schema import cycle usager_circuits <-> avenants). Null = direct
    // association / base composition. Used to cleanly revert assignment
    // versioning when an avenant is cancelled.
    createdByAvenantId: uuid("created_by_avenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Back-to-school preparation: null = production, otherwise a draft copy linked to a campaign.
    preparationCampaignId: uuid("preparation_campaign_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Only one OPEN version (valid_to null) per usager/circuit pair.
    uniqueIndex("usager_circuits_open_version_idx")
      .on(table.usagerId, table.circuitId)
      .where(sql`${table.validTo} is null and ${table.deletedAt} is null`),
    // Only one ACTIVE circuit per usager/address pair (open version).
    // Changes go through an avenant; free-address association remains direct.
    // usager_address_id null (deleted address) excluded.
    uniqueIndex("usager_circuits_open_address_idx")
      .on(table.usagerId, table.usagerAddressId)
      .where(
        sql`${table.validTo} is null and ${table.deletedAt} is null and ${table.usagerAddressId} is not null`,
      ),
  ],
);

export type UsagerCircuit = typeof usagerCircuits.$inferSelect;
export type NewUsagerCircuit = typeof usagerCircuits.$inferInsert;

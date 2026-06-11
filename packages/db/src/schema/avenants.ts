import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { circuits } from "./circuits";
import { usagers } from "./usagers";
import { usagerCircuits } from "./usager-circuits";
import { usagerAddresses } from "./usager-addresses";
import { users } from "./users";

type DayArray = number[] | { day: number; parity: "all" | "even" | "odd" }[];

/**
 * Frozen snapshot (before/after) of an avenant change.
 * The shape depends on `avenant_changes.type` (discriminant on the row).
 * IDs are stored without FK constraints: the value is frozen as-is at time T
 * to preserve history even if the target is deleted later.
 */
export type AvenantSnapshot =
  | {
      etablissementId: string | null;
      etablissementName: string | null;
      secondaryEtablissementId?: string | null;
      secondaryEtablissementName?: string | null;
    }
  | {
      transportType: string | null;
      transportTypeLabel: string | null;
    }
  | {
      circuitId: string | null;
      circuitName: string | null;
      usagerAddressId: string | null;
    }
  | {
      circuitId: string;
      daysAller: DayArray;
      daysRetour: DayArray;
    }
  | {
      usagerAddressId: string;
      address: string | null;
      city: string | null;
      postalCode: string | null;
      latitude: number | null;
      longitude: number | null;
      type: string | null;
    };

/** Avenant header: a dated/numbered object attached to a circuit. */
export const avenants = pgTable(
  "avenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    displayId: integer("display_id").notNull(),
    circuitId: uuid("circuit_id").references(() => circuits.id, {
      onDelete: "set null",
    }),
    // Avenant sequence number WITHIN the circuit (Avenant n°1, n°2…). Null if outside a circuit.
    circuitSequence: integer("circuit_sequence"),
    effectiveDate: date("effective_date").notNull(),
    endDate: date("end_date"),
    reason: text("reason").notNull(),
    // brouillon | planifie | applique | annule
    status: varchar("status", { length: 20 }).notNull().default("brouillon"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
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
  (t) => [
    unique("avenants_tenant_display_id_unique").on(t.tenantId, t.displayId),
    index("avenants_circuit_idx").on(t.circuitId),
    index("avenants_status_effective_idx").on(
      t.tenantId,
      t.status,
      t.effectiveDate,
    ),
  ],
);

/** Avenant detail: one change record per usager × type. */
export const avenantChanges = pgTable(
  "avenant_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    avenantId: uuid("avenant_id")
      .notNull()
      .references(() => avenants.id, { onDelete: "cascade" }),
    usagerId: uuid("usager_id")
      .notNull()
      .references(() => usagers.id, { onDelete: "cascade" }),
    // etablissement | type_transport | circuit | jours_pec | adresse
    type: varchar("type", { length: 30 }).notNull(),
    usagerCircuitId: uuid("usager_circuit_id").references(
      () => usagerCircuits.id,
      { onDelete: "set null" },
    ),
    usagerAddressId: uuid("usager_address_id").references(
      () => usagerAddresses.id,
      { onDelete: "set null" },
    ),
    previousValue: jsonb("previous_value").$type<AvenantSnapshot>(),
    newValue: jsonb("new_value").$type<AvenantSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("avenant_changes_avenant_idx").on(t.avenantId),
    index("avenant_changes_usager_idx").on(t.usagerId),
  ],
);

export type Avenant = typeof avenants.$inferSelect;
export type NewAvenant = typeof avenants.$inferInsert;
export type AvenantChange = typeof avenantChanges.$inferSelect;
export type NewAvenantChange = typeof avenantChanges.$inferInsert;

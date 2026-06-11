import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  jsonb,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { etablissements } from "./etablissements";

export const circuits = pgTable(
  "circuits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Sequential human-readable number per tenant (distinct from the UUID).
    displayId: integer("display_id").notNull(),
    etablissementId: uuid("etablissement_id")
      .notNull()
      .references(() => etablissements.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
  // Optional code (client reference), shared by the circuit's trajets.
  code: varchar("code", { length: 50 }),
  description: text("description"),
  // Control/validation status (same model as usager) — distinct from archiving.
  status: varchar("status", { length: 20 }).notNull().default("non_controle"),
  // Archiving (lifecycle): null = current, dated = archived/historised.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // Back-to-school preparation: null = production, otherwise a draft copy linked to a campaign.
  // FK defined in SQL (avoids a schema import cycle).
  preparationCampaignId: uuid("preparation_campaign_id"),
  // Traceability: copy → original production entity (FK in SQL).
  sourceId: uuid("source_id"),
  operatingDays: jsonb("operating_days").$type<
    number[] | { day: number; parity: "all" | "even" | "odd" }[]
  >(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("circuits_tenant_display_id_idx").on(t.tenantId, t.displayId),
  ],
);

export type Circuit = typeof circuits.$inferSelect;
export type NewCircuit = typeof circuits.$inferInsert;

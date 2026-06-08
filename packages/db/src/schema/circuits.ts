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
    // N° lisible séquentiel par tenant (distinct de l'UUID).
    displayId: integer("display_id").notNull(),
    etablissementId: uuid("etablissement_id")
      .notNull()
      .references(() => etablissements.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
  // Code optionnel (référence client), partagé par les trajets du circuit.
  code: varchar("code", { length: 50 }),
  description: text("description"),
  // Statut de contrôle/validation (façon usager) — distinct de l'archivage.
  status: varchar("status", { length: 20 }).notNull().default("non_controle"),
  // Archivage (cycle de vie) : null = courant, daté = archivé/historisé.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // Préparation de rentrée : null = production, sinon copie liée à une campagne.
  // FK posée en SQL (évite un cycle d'import schéma).
  preparationCampaignId: uuid("preparation_campaign_id"),
  // Traçabilité copie → entité prod d'origine (FK en SQL).
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

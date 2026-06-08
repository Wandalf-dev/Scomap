import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Campagne de préparation de rentrée : espace de travail isolé qui regroupe
 * des copies « brouillon » d'usagers/circuits (via la FK preparation_campaign_id
 * sur les entités). La production reste intacte tant que la campagne n'est pas
 * activée. À l'activation, les copies deviennent prod et l'ancienne est archivée.
 */
export const preparationCampaigns = pgTable(
  "preparation_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    // Libellé d'année lisible (« 2026-2027 ») — purement informatif (pas de
    // sémantique structurelle d'année scolaire).
    schoolYearLabel: varchar("school_year_label", { length: 50 }),
    // Dates cibles de la rentrée préparée (servent à recaler les dates des copies).
    targetStartDate: date("target_start_date"),
    targetEndDate: date("target_end_date"),
    // en_cours | activee | abandonnee
    status: varchar("status", { length: 20 }).notNull().default("en_cours"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Au plus UNE campagne « en cours » par tenant (index unique partiel).
    uniqueIndex("preparation_campaigns_one_open_per_tenant_idx")
      .on(t.tenantId)
      .where(sql`status = 'en_cours' and deleted_at is null`),
  ],
);

export type PreparationCampaign = typeof preparationCampaigns.$inferSelect;
export type NewPreparationCampaign = typeof preparationCampaigns.$inferInsert;

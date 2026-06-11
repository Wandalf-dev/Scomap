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
 * Back-to-school preparation campaign: isolated workspace that groups
 * draft copies of usagers/circuits (via the preparation_campaign_id FK
 * on entities). Production remains untouched until the campaign is activated.
 * On activation, the copies become production and the old ones are archived.
 */
export const preparationCampaigns = pgTable(
  "preparation_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull(),
    // Human-readable year label ("2026-2027") — purely informational (no
    // structural school-year semantics).
    schoolYearLabel: varchar("school_year_label", { length: 50 }),
    // Target dates of the prepared school year (used to rebase the copy dates).
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
    // At most ONE active campaign per tenant (partial unique index).
    uniqueIndex("preparation_campaigns_one_open_per_tenant_idx")
      .on(t.tenantId)
      .where(sql`status = 'en_cours' and deleted_at is null`),
  ],
);

export type PreparationCampaign = typeof preparationCampaigns.$inferSelect;
export type NewPreparationCampaign = typeof preparationCampaigns.$inferInsert;

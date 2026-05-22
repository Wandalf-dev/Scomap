import {
  pgTable,
  uuid,
  varchar,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantCounters = pgTable(
  "tenant_counters",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entity: varchar("entity", { length: 50 }).notNull(),
    lastValue: bigint("last_value", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.entity] })],
);

export type TenantCounter = typeof tenantCounters.$inferSelect;

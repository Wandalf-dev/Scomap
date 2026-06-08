import { sql } from "drizzle-orm";
import { db } from "@scomap/db";

// Accepte la base ou une transaction : on n'a besoin que de `.execute`.
type DbOrTx = Pick<typeof db, "execute">;

/**
 * Atomically returns the next per-tenant display id for a given entity.
 * Backed by the tenant_counters table; safe under concurrent inserts thanks
 * to PostgreSQL's row-level lock on the UPSERT.
 */
export async function nextDisplayId(
  database: DbOrTx,
  tenantId: string,
  entity: string,
): Promise<number> {
  const rows = await database.execute<{ last_value: string | number }>(sql`
    INSERT INTO tenant_counters (tenant_id, entity, last_value)
    VALUES (${tenantId}, ${entity}, 1)
    ON CONFLICT (tenant_id, entity)
    DO UPDATE SET last_value = tenant_counters.last_value + 1
    RETURNING last_value
  `);
  const value = rows[0]?.last_value;
  if (value === undefined) {
    throw new Error(`Failed to allocate display_id for ${entity}/${tenantId}`);
  }
  return Number(value);
}

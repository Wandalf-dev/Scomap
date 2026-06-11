import { TRPCError } from "@trpc/server";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { db } from "@scomap/db";

type OwnedTable = PgTable & {
  id: AnyPgColumn;
  tenantId: AnyPgColumn;
  deletedAt?: AnyPgColumn;
};

/**
 * Anti-IDOR guard: verifies that a FK id provided as input belongs to the
 * current tenant. Without this check, a mutation could reference another
 * tenant's object, which read joins would then expose.
 * Throws NOT_FOUND (not FORBIDDEN) to avoid revealing whether the id exists.
 */
export async function assertTenantOwned(
  database: typeof db,
  table: OwnedTable,
  id: string,
  tenantId: string,
  label: string,
): Promise<void> {
  const conditions: SQL[] = [eq(table.id, id), eq(table.tenantId, tenantId)];
  if (table.deletedAt) {
    conditions.push(isNull(table.deletedAt));
  }

  const count = await database.$count(table, and(...conditions));
  if (count === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${label} introuvable` });
  }
}

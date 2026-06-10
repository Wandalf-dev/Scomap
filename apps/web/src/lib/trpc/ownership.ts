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
 * Garde anti-IDOR : vérifie qu'un id de FK fourni en input appartient bien au
 * tenant courant. Sans cette validation, une mutation peut référencer l'objet
 * d'un autre tenant, que les jointures de lecture exposeraient ensuite.
 * Throw NOT_FOUND (et non FORBIDDEN) pour ne pas révéler l'existence de l'id.
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

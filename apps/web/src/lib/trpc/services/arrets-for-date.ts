import { eq, and, isNull, or, lte, gte, asc } from "drizzle-orm";
import type { db } from "@scomap/db";
import { arrets, usagerAddresses, usagers } from "@scomap/db/schema";

/**
 * Base arrêts of a trajet RESOLVED at a given date: only the presence active
 * that day (avenants bind arrêts in time via validFrom/validTo). Shared by
 * `arrets.forDate` and the occurrence "fiche trajet du jour".
 */
export async function resolveArretsForDate(
  database: typeof db,
  tenantId: string,
  trajetId: string,
  date: string,
) {
  return database
    .select({
      id: arrets.id,
      type: arrets.type,
      name: arrets.name,
      address: arrets.address,
      orderIndex: arrets.orderIndex,
      arrivalTime: arrets.arrivalTime,
      usagerId: usagers.id,
      // Extra fields used by the occurrence "fiche trajet du jour"
      usagerAddressId: arrets.usagerAddressId,
      etablissementId: arrets.etablissementId,
      latitude: arrets.latitude,
      longitude: arrets.longitude,
      waitTime: arrets.waitTime,
      timeLocked: arrets.timeLocked,
      distanceKm: arrets.distanceKm,
      durationSeconds: arrets.durationSeconds,
    })
    .from(arrets)
    .leftJoin(
      usagerAddresses,
      and(
        eq(arrets.usagerAddressId, usagerAddresses.id),
        eq(usagerAddresses.tenantId, tenantId),
      ),
    )
    .leftJoin(
      usagers,
      and(
        eq(usagerAddresses.usagerId, usagers.id),
        eq(usagers.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(arrets.trajetId, trajetId),
        isNull(arrets.deletedAt),
        or(isNull(arrets.validFrom), lte(arrets.validFrom, date)),
        or(isNull(arrets.validTo), gte(arrets.validTo, date)),
      ),
    )
    .orderBy(asc(arrets.orderIndex));
}

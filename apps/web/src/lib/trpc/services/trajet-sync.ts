import { eq, and, isNull, sql } from "drizzle-orm";
import {
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  trajets,
  arrets,
} from "@scomap/db/schema";
import {
  normalizeDays,
  areDayEntriesEqual,
  formatDaysShort,
  type DayEntry,
} from "@/lib/types/day-entry";

/**
 * Shared trajet/arret synchronisation helpers.
 *
 * Extracted from the usager-circuits router so they can be reused by the
 * avenants feature (which also re-routes usagers between circuits, changes
 * their pickup days/address, etc.). Pure data layer — every function takes a
 * tenant-scoped Ctx and never assumes a request context.
 */
export type TrajetSyncCtx = {
  db: typeof import("@scomap/db").db;
  tenantId: string;
};

export function buildTrajetName(direction: string, days: DayEntry[]): string {
  const label = direction === "aller" ? "Aller" : "Retour";
  return `${label} ${formatDaysShort(days)}`;
}

export async function autoCreateEtablissementArret(
  ctx: TrajetSyncCtx,
  trajetId: string,
  circuitId: string,
) {
  const circuit = await ctx.db
    .select({
      etablissementId: circuits.etablissementId,
      etablissementName: etablissements.name,
      etablissementAddress: etablissements.address,
      etablissementCity: etablissements.city,
      etablissementPostalCode: etablissements.postalCode,
      etablissementLatitude: etablissements.latitude,
      etablissementLongitude: etablissements.longitude,
    })
    .from(circuits)
    .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
    .where(eq(circuits.id, circuitId))
    .limit(1);

  const c = circuit[0];
  if (!c?.etablissementId) return;

  await ctx.db.insert(arrets).values({
    tenantId: ctx.tenantId,
    trajetId,
    type: "etablissement",
    etablissementId: c.etablissementId,
    name: c.etablissementName ?? "Etablissement",
    address: [c.etablissementAddress, c.etablissementPostalCode, c.etablissementCity]
      .filter(Boolean)
      .join(", "),
    latitude: c.etablissementLatitude ?? null,
    longitude: c.etablissementLongitude ?? null,
    orderIndex: 0,
  });
}

export async function addUsagerArret(
  ctx: TrajetSyncCtx,
  trajetId: string,
  usagerAddressId: string,
  validFrom: string | null = null,
) {
  // Check if an OPEN usager arret already exists on this trajet (date-bounded
  // closed arrets don't block re-adding a new membership window).
  const existing = await ctx.db
    .select({ id: arrets.id })
    .from(arrets)
    .where(
      and(
        eq(arrets.trajetId, trajetId),
        eq(arrets.usagerAddressId, usagerAddressId),
        isNull(arrets.deletedAt),
        isNull(arrets.validTo),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  // Fetch address info with usager name
  const addr = await ctx.db
    .select({
      address: usagerAddresses.address,
      city: usagerAddresses.city,
      postalCode: usagerAddresses.postalCode,
      latitude: usagerAddresses.latitude,
      longitude: usagerAddresses.longitude,
      type: usagerAddresses.type,
      usagerFirstName: usagers.firstName,
      usagerLastName: usagers.lastName,
    })
    .from(usagerAddresses)
    .innerJoin(usagers, eq(usagerAddresses.usagerId, usagers.id))
    .where(eq(usagerAddresses.id, usagerAddressId))
    .limit(1);

  const a = addr[0];
  if (!a) return;

  // Get max orderIndex on this trajet
  const maxResult = await ctx.db
    .select({ maxIdx: sql<number>`coalesce(max(${arrets.orderIndex}), 0)` })
    .from(arrets)
    .where(
      and(eq(arrets.trajetId, trajetId), isNull(arrets.deletedAt)),
    );

  const maxIdx = maxResult[0]?.maxIdx ?? 0;

  await ctx.db.insert(arrets).values({
    tenantId: ctx.tenantId,
    trajetId,
    type: "usager",
    usagerAddressId,
    name: `${a.usagerLastName} ${a.usagerFirstName}`,
    address: [a.address, a.postalCode, a.city].filter(Boolean).join(", "),
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    orderIndex: maxIdx + 1,
    validFrom,
  });
}

export async function syncTrajetForDirection(
  ctx: TrajetSyncCtx,
  circuitId: string,
  direction: string,
  days: DayEntry[],
  usagerAddressId: string,
  validFrom: string | null = null,
) {
  if (!days || days.length === 0) return;

  // Load existing trajets for this circuit + direction (non-deleted)
  const existingTrajets = await ctx.db
    .select({
      id: trajets.id,
      recurrence: trajets.recurrence,
    })
    .from(trajets)
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        eq(trajets.direction, direction),
        isNull(trajets.deletedAt),
      ),
    );

  // Find a trajet with matching daysOfWeek (normalize legacy data)
  const matchingTrajet = existingTrajets.find((t) => {
    const rec = t.recurrence as { daysOfWeek: unknown } | null;
    if (!rec?.daysOfWeek) return false;
    const existingDays = normalizeDays(rec.daysOfWeek);
    return areDayEntriesEqual(existingDays, days);
  });

  if (matchingTrajet) {
    // Add usager arret to existing trajet
    await addUsagerArret(ctx, matchingTrajet.id, usagerAddressId, validFrom);
  } else {
    // Create new trajet
    const sortedDays = [...days].sort((a, b) => a.day - b.day);
    const name = buildTrajetName(direction, sortedDays);
    const result = await ctx.db
      .insert(trajets)
      .values({
        tenantId: ctx.tenantId,
        circuitId,
        name,
        direction,
        recurrence: { frequency: "weekly" as const, daysOfWeek: sortedDays },
      })
      .returning();

    const created = result[0];
    if (created) {
      await autoCreateEtablissementArret(ctx, created.id, circuitId);
      await addUsagerArret(ctx, created.id, usagerAddressId, validFrom);
    }
  }
}

/**
 * Clôt (au lieu de supprimer) la présence d'un usager sur les trajets d'un
 * circuit à une date donnée : les arrêts ouverts reçoivent valid_to = endDate.
 * Utilisé par les avenants pour borner l'ancienne affectation dans le temps.
 */
export async function endUsagerArretsAt(
  ctx: TrajetSyncCtx,
  circuitId: string,
  usagerAddressId: string,
  endDate: string,
) {
  const circuitTrajets = await ctx.db
    .select({ id: trajets.id })
    .from(trajets)
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        isNull(trajets.deletedAt),
      ),
    );

  for (const trajet of circuitTrajets) {
    await ctx.db
      .update(arrets)
      .set({ validTo: endDate, updatedAt: new Date() })
      .where(
        and(
          eq(arrets.trajetId, trajet.id),
          eq(arrets.usagerAddressId, usagerAddressId),
          isNull(arrets.deletedAt),
          isNull(arrets.validTo),
        ),
      );
  }
}

export async function removeUsagerArretsFromCircuit(
  ctx: TrajetSyncCtx,
  circuitId: string,
  usagerAddressId: string,
) {
  // Load trajets for this circuit
  const circuitTrajets = await ctx.db
    .select({ id: trajets.id })
    .from(trajets)
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        isNull(trajets.deletedAt),
      ),
    );

  for (const trajet of circuitTrajets) {
    // Soft-delete arrets with this usagerAddressId
    await ctx.db
      .update(arrets)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(arrets.trajetId, trajet.id),
          eq(arrets.usagerAddressId, usagerAddressId),
          isNull(arrets.deletedAt),
        ),
      );

    // Check if trajet still has usager arrets
    const remaining = await ctx.db
      .select({ id: arrets.id })
      .from(arrets)
      .where(
        and(
          eq(arrets.trajetId, trajet.id),
          eq(arrets.type, "usager"),
          isNull(arrets.deletedAt),
        ),
      )
      .limit(1);

    // If no usager arrets left, soft-delete the trajet
    if (remaining.length === 0) {
      await ctx.db
        .update(trajets)
        .set({ deletedAt: new Date() })
        .where(eq(trajets.id, trajet.id));
    }
  }
}

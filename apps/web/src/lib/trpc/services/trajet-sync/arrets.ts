import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  trajets,
  arrets,
} from "@scomap/db/schema";
import type { TrajetSyncCtx } from "./types";

export async function autoCreateEtablissementArret(
  ctx: TrajetSyncCtx,
  trajetId: string,
  circuitId: string,
  arrivalTime: string | null = null,
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
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
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
    // School time = locked anchor (PEC times are derived from it).
    arrivalTime: arrivalTime,
    timeLocked: arrivalTime != null,
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
        eq(arrets.tenantId, ctx.tenantId),
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
    .where(
      and(
        eq(usagerAddresses.id, usagerAddressId),
        eq(usagerAddresses.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);

  const a = addr[0];
  if (!a) return;

  // Placement by direction (same rule as the manual addition in arrets.ts, and as
  // calculateTimes which anchors the school at the end of the list):
  // - "aller": the school is the destination (last arret) → insert the usager
  //   just BEFORE it (shifting the school and the following arrets).
  // - "retour": the school is the origin (first arret) → append at the end.
  const trajetRow = await ctx.db
    .select({ direction: trajets.direction })
    .from(trajets)
    .where(and(eq(trajets.id, trajetId), eq(trajets.tenantId, ctx.tenantId)))
    .limit(1);
  const direction = trajetRow[0]?.direction;

  const existingArrets = await ctx.db
    .select({ id: arrets.id, orderIndex: arrets.orderIndex, type: arrets.type })
    .from(arrets)
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        eq(arrets.trajetId, trajetId),
        isNull(arrets.deletedAt),
      ),
    );

  const maxIdx = existingArrets.reduce((m, x) => Math.max(m, x.orderIndex), -1);
  const ecole = existingArrets.find((x) => x.type === "etablissement");
  const insertPos = direction === "aller" && ecole ? ecole.orderIndex : maxIdx + 1;

  // Make room: shift by one any arret located at/after the insertion point.
  for (const x of existingArrets) {
    if (x.orderIndex >= insertPos) {
      await ctx.db
        .update(arrets)
        .set({ orderIndex: x.orderIndex + 1, updatedAt: new Date() })
        .where(and(eq(arrets.id, x.id), eq(arrets.tenantId, ctx.tenantId)));
    }
  }

  await ctx.db.insert(arrets).values({
    tenantId: ctx.tenantId,
    trajetId,
    type: "usager",
    usagerAddressId,
    name: `${a.usagerLastName} ${a.usagerFirstName}`,
    address: [a.address, a.postalCode, a.city].filter(Boolean).join(", "),
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    orderIndex: insertPos,
    validFrom,
  });
}

/**
 * Closes (instead of deleting) a usager's presence on a circuit's trajets at a
 * given date: open arrets receive valid_to = endDate. Used by avenants to
 * bound the old assignment in time.
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
  const trajetIds = circuitTrajets.map((t) => t.id);
  if (trajetIds.length === 0) return;

  // Bound all open arrets of this address in a single UPDATE.
  await ctx.db
    .update(arrets)
    .set({ validTo: endDate, updatedAt: new Date() })
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        inArray(arrets.trajetId, trajetIds),
        eq(arrets.usagerAddressId, usagerAddressId),
        isNull(arrets.deletedAt),
        isNull(arrets.validTo),
      ),
    );
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
  const trajetIds = circuitTrajets.map((t) => t.id);
  if (trajetIds.length === 0) return;

  const now = new Date();

  // 1. Soft-delete the arrets of this address in a single UPDATE.
  await ctx.db
    .update(arrets)
    .set({ deletedAt: now })
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        inArray(arrets.trajetId, trajetIds),
        eq(arrets.usagerAddressId, usagerAddressId),
        isNull(arrets.deletedAt),
      ),
    );

  // 2. Trajets that still have at least one active usager arret.
  const stillUsed = await ctx.db
    .select({ trajetId: arrets.trajetId })
    .from(arrets)
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        inArray(arrets.trajetId, trajetIds),
        eq(arrets.type, "usager"),
        isNull(arrets.deletedAt),
      ),
    );
  const usedSet = new Set(stillUsed.map((r) => r.trajetId));
  const emptyTrajetIds = trajetIds.filter((id) => !usedSet.has(id));

  // 3. Soft-delete the trajets left empty, in a single UPDATE.
  if (emptyTrajetIds.length > 0) {
    await ctx.db
      .update(trajets)
      .set({ deletedAt: now })
      .where(
        and(
          eq(trajets.tenantId, ctx.tenantId),
          inArray(trajets.id, emptyTrajetIds),
        ),
      );
  }
}

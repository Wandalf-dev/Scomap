import { eq, and, isNull } from "drizzle-orm";
import { avenantChanges, usagers, usagerCircuits } from "@scomap/db/schema";
import { normalizeDays } from "@/lib/types/day-entry";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { endUsagerArretsAt } from "../../services/trajet-sync";
import { dayBefore, readAddressDays, syncTrajets, type Ctx } from "./helpers";

type ChangeRow = typeof avenantChanges.$inferSelect;

// ── Applying a change — DATED VERSIONING (zero triggers) ────────────
// The current state is never mutated: the active version is closed at D-1 and
// a new version is opened starting from the effective date. The old and the
// new coexist, bounded by dates; planning resolves by date.
export async function applyChange(
  ctx: Ctx,
  change: ChangeRow,
  effectiveDate: string,
): Promise<void> {
  const nv = change.newValue;
  if (!nv) return;

  // Etablissement = administrative attribute of the usager (not a dated
  // assignment): applied directly on the usager record.
  if (change.type === "etablissement" && "etablissementId" in nv) {
    await ctx.db
      .update(usagers)
      .set({
        etablissementId: nv.etablissementId,
        ...(nv.secondaryEtablissementId !== undefined
          ? { secondaryEtablissementId: nv.secondaryEtablissementId }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      );
    return;
  }

  // Transport type = attribute of the usager. Applied directly; if the new
  // mode is not a "circuit" mode (famille / transport en commun), all active
  // circuit assignments are closed at D-1 (the circuit is dropped).
  if (change.type === "type_transport" && "transportType" in nv) {
    await ctx.db
      .update(usagers)
      .set({ transportType: nv.transportType, updatedAt: new Date() })
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      );

    if (!isCircuitCompatibleTransport(nv.transportType)) {
      const endOld = dayBefore(effectiveDate);
      const actives = await ctx.db
        .select()
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.usagerId, change.usagerId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        );
      for (const uc of actives) {
        // Close the assignment version at D-1 (no new version: no more circuit).
        await ctx.db
          .update(usagerCircuits)
          .set({ validTo: endOld, updatedAt: new Date() })
          .where(
            and(
              eq(usagerCircuits.id, uc.id),
              eq(usagerCircuits.tenantId, ctx.tenantId),
            ),
          );
        // Bound the usager's arrêts on this circuit at D-1.
        if (uc.usagerAddressId) {
          await endUsagerArretsAt(ctx, uc.circuitId, uc.usagerAddressId, endOld);
        }
      }
    }
    return;
  }

  if (!change.usagerCircuitId) return;
  const ucRows = await ctx.db
    .select()
    .from(usagerCircuits)
    .where(
      and(
        eq(usagerCircuits.id, change.usagerCircuitId),
        eq(usagerCircuits.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);
  const old = ucRows[0];
  // Only version from an OPEN, non-deleted version.
  if (!old || old.validTo || old.deletedAt) return;

  // New version values: inherited from the old one, except the changed field.
  let newCircuitId = old.circuitId;
  let newAddressId = old.usagerAddressId;
  let daysAller = normalizeDays(old.daysAller);
  let daysRetour = normalizeDays(old.daysRetour);

  if (
    change.type === "circuit" &&
    "circuitId" in nv &&
    "usagerAddressId" in nv &&
    nv.circuitId
  ) {
    newCircuitId = nv.circuitId;
    if (nv.usagerAddressId) newAddressId = nv.usagerAddressId;
  } else if (change.type === "jours_pec" && "daysAller" in nv) {
    daysAller = normalizeDays(nv.daysAller);
    daysRetour = normalizeDays(nv.daysRetour);
  } else if (
    change.type === "adresse" &&
    "usagerAddressId" in nv &&
    nv.usagerAddressId
  ) {
    newAddressId = nv.usagerAddressId;
  } else {
    return;
  }

  // Empty days (legacy data) → fall back to the target address.
  if (daysAller.length === 0 && daysRetour.length === 0 && newAddressId) {
    const ad = await readAddressDays(ctx, newAddressId);
    daysAller = ad.daysAller;
    daysRetour = ad.daysRetour;
  }

  const endOld = dayBefore(effectiveDate);

  // 1. Close the current version at D-1.
  await ctx.db
    .update(usagerCircuits)
    .set({ validTo: endOld, updatedAt: new Date() })
    .where(
      and(
        eq(usagerCircuits.id, old.id),
        eq(usagerCircuits.tenantId, ctx.tenantId),
      ),
    );

  // 2. Open the new version starting from the effective date. It is marked as
  // created by this avenant: cancellation can soft-delete it and reopen the old one.
  await ctx.db.insert(usagerCircuits).values({
    tenantId: ctx.tenantId,
    usagerId: old.usagerId,
    circuitId: newCircuitId,
    usagerAddressId: newAddressId,
    daysAller: daysAller.length > 0 ? daysAller : null,
    daysRetour: daysRetour.length > 0 ? daysRetour : null,
    arrivalNotification: old.arrivalNotification,
    authorizationAlone: old.authorizationAlone,
    validFrom: effectiveDate,
    validTo: null,
    createdByAvenantId: change.avenantId,
  });

  // 3. Bound the arrêts of the old assignment at D-1.
  if (old.usagerAddressId) {
    await endUsagerArretsAt(ctx, old.circuitId, old.usagerAddressId, endOld);
  }
  // 4. Create the arrêts of the new assignment starting from the effective date.
  if (newAddressId) {
    await syncTrajets(
      ctx,
      newCircuitId,
      { daysAller, daysRetour },
      newAddressId,
      effectiveDate,
      change.avenantId,
    );
  }
}

import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  usagers,
  usagerCircuits,
  trajets,
  arrets,
  avenantChanges,
} from "@scomap/db/schema";
import { dayBeforeStr } from "./helpers";
import type { TrajetSyncCtx } from "./types";

/**
 * RESTORES the ASSIGNMENTS (usager_circuits) and usager attributes an avenant
 * had modified — complement of `revertAvenantVersioning` (which only handles the
 * dated trajets produced by `regenerateCircuitTrajets`). Called when cancelling
 * an avenant to restore the previous state:
 *  1. soft-delete the assignment versions CREATED by the avenant (created_by_avenant_id);
 *  2. REOPENS (valid_to -> null) the versions closed at D-1 by the avenant:
 *     - those targeted by the change (circuit / jours_pec / address), via usager_circuit_id;
 *     - for type_transport (which closes without recreating), the usager's
 *       assignments closed at D-1;
 *  3. realigns the ARRETS with the restored composition (soft-delete those created at D,
 *     reopen those bounded at D-1), targeted by (circuit, address) of the affected versions;
 *  4. restores the modified usager attributes (transport type, etablissement).
 *
 * The soft-delete -> reopen order matters: it avoids violating the partial
 * unique indexes "a single open version per (usager, circuit) / (usager, address)".
 *
 * ⚠ Like `revertAvenantVersioning`, reliable for 1 avenant at a given date (merging
 * guarantees a single avenant per (circuit, date)). For nested chains, reopening
 * by date remains approximate.
 */
export async function revertAvenantAssignments(
  ctx: TrajetSyncCtx,
  avenantId: string,
  effectiveDate: string,
) {
  const now = new Date();
  const endOld = dayBeforeStr(effectiveDate);

  const changes = await ctx.db
    .select({
      type: avenantChanges.type,
      usagerId: avenantChanges.usagerId,
      usagerCircuitId: avenantChanges.usagerCircuitId,
      previousValue: avenantChanges.previousValue,
    })
    .from(avenantChanges)
    .where(
      and(
        eq(avenantChanges.avenantId, avenantId),
        eq(avenantChanges.tenantId, ctx.tenantId),
      ),
    );
  if (changes.length === 0) return;

  // ── 1. Assignment versions CREATED by the avenant ──────────────────────────
  // Read BEFORE the soft-delete so their arrets can be realigned afterwards (circuit + address).
  const createdVersions = await ctx.db
    .select({
      circuitId: usagerCircuits.circuitId,
      usagerAddressId: usagerCircuits.usagerAddressId,
    })
    .from(usagerCircuits)
    .where(
      and(
        eq(usagerCircuits.createdByAvenantId, avenantId),
        eq(usagerCircuits.tenantId, ctx.tenantId),
        isNull(usagerCircuits.deletedAt),
      ),
    );

  // ── 2. Versions to REOPEN (closed at D-1 by this avenant) ──────────────────
  // a) targeted by the change (circuit / jours_pec / address).
  const targetedIds = [
    ...new Set(
      changes
        .map((c) => c.usagerCircuitId)
        .filter((id): id is string => !!id),
    ),
  ];
  // b) type_transport: assignments closed at D-1 without recreating a version.
  const transportUsagerIds = [
    ...new Set(
      changes.filter((c) => c.type === "type_transport").map((c) => c.usagerId),
    ),
  ];

  const reopenMap = new Map<
    string,
    { id: string; circuitId: string; usagerAddressId: string | null }
  >();
  if (targetedIds.length > 0) {
    const rows = await ctx.db
      .select({
        id: usagerCircuits.id,
        circuitId: usagerCircuits.circuitId,
        usagerAddressId: usagerCircuits.usagerAddressId,
      })
      .from(usagerCircuits)
      .where(
        and(
          inArray(usagerCircuits.id, targetedIds),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          eq(usagerCircuits.validTo, endOld),
          isNull(usagerCircuits.deletedAt),
        ),
      );
    for (const r of rows) reopenMap.set(r.id, r);
  }
  if (transportUsagerIds.length > 0) {
    const rows = await ctx.db
      .select({
        id: usagerCircuits.id,
        circuitId: usagerCircuits.circuitId,
        usagerAddressId: usagerCircuits.usagerAddressId,
      })
      .from(usagerCircuits)
      .where(
        and(
          inArray(usagerCircuits.usagerId, transportUsagerIds),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          eq(usagerCircuits.validTo, endOld),
          isNull(usagerCircuits.deletedAt),
          // A version created by an avenant cannot be an "old" version to
          // reopen (it was deleted in step 3).
          isNull(usagerCircuits.createdByAvenantId),
        ),
      );
    for (const r of rows) reopenMap.set(r.id, r);
  }
  const reopenVersions = [...reopenMap.values()];

  // ── 3. Apply on usager_circuits: soft-delete THEN reopen ───────────────────
  if (createdVersions.length > 0) {
    await ctx.db
      .update(usagerCircuits)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(usagerCircuits.createdByAvenantId, avenantId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          isNull(usagerCircuits.deletedAt),
        ),
      );
  }
  if (reopenVersions.length > 0) {
    await ctx.db
      .update(usagerCircuits)
      .set({ validTo: null, updatedAt: now })
      .where(
        and(
          inArray(
            usagerCircuits.id,
            reopenVersions.map((v) => v.id),
          ),
          eq(usagerCircuits.tenantId, ctx.tenantId),
        ),
      );
  }

  // ── 4. Realign the arrets with the restored composition ────────────────────
  // Delete the arrets created at D (the avenant's new composition)...
  for (const v of createdVersions) {
    if (v.usagerAddressId) {
      await removeAvenantArretsAt(ctx, v.circuitId, v.usagerAddressId, effectiveDate);
    }
  }
  // ... and reopen those bounded at D-1 (old composition).
  for (const v of reopenVersions) {
    if (v.usagerAddressId) {
      await reopenArretsAt(ctx, v.circuitId, v.usagerAddressId, endOld);
    }
  }

  // ── 5. Restore the modified usager attributes ──────────────────────────────
  for (const c of changes) {
    const prev = c.previousValue;
    if (!prev) continue;
    if (c.type === "type_transport" && "transportType" in prev) {
      await ctx.db
        .update(usagers)
        .set({ transportType: prev.transportType, updatedAt: now })
        .where(
          and(eq(usagers.id, c.usagerId), eq(usagers.tenantId, ctx.tenantId)),
        );
    } else if (c.type === "etablissement" && "etablissementId" in prev) {
      await ctx.db
        .update(usagers)
        .set({
          etablissementId: prev.etablissementId,
          secondaryEtablissementId: prev.secondaryEtablissementId ?? null,
          updatedAt: now,
        })
        .where(
          and(eq(usagers.id, c.usagerId), eq(usagers.tenantId, ctx.tenantId)),
        );
    }
  }
}

/**
 * Soft-deletes the arrets of an address, on a circuit's trajets, created at an
 * effective date (valid_from = D) — the "new" composition of an avenant being
 * cancelled. Then soft-deletes the trajets left empty (no more active usager
 * arret). ARRET granularity (not trajet): a shared trajet created by the
 * avenant but populated by other usagers is preserved.
 */
async function removeAvenantArretsAt(
  ctx: TrajetSyncCtx,
  circuitId: string,
  usagerAddressId: string,
  validFrom: string,
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

  const now = new Date();
  await ctx.db
    .update(arrets)
    .set({ deletedAt: now })
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        inArray(arrets.trajetId, trajetIds),
        eq(arrets.usagerAddressId, usagerAddressId),
        eq(arrets.validFrom, validFrom),
        isNull(arrets.deletedAt),
      ),
    );

  // Trajets that still have at least one active usager arret.
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

/**
 * Reopens (valid_to -> null) the arrets of an address, on a circuit's trajets,
 * bounded at D-1 — the "old" composition a cancelled avenant had closed.
 */
async function reopenArretsAt(
  ctx: TrajetSyncCtx,
  circuitId: string,
  usagerAddressId: string,
  endOld: string,
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

  await ctx.db
    .update(arrets)
    .set({ validTo: null, updatedAt: new Date() })
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        inArray(arrets.trajetId, trajetIds),
        eq(arrets.usagerAddressId, usagerAddressId),
        eq(arrets.validTo, endOld),
        isNull(arrets.deletedAt),
      ),
    );
}

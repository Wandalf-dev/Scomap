import {
  eq,
  and,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  or,
  ne,
  lte,
  gte,
} from "drizzle-orm";
import {
  circuits,
  etablissements,
  usagerCircuits,
  trajets,
  arrets,
  trajetOccurrences,
} from "@scomap/db/schema";
import { normalizeDays, formatDaysShort, type DayEntry } from "@/lib/types/day-entry";
import { nextDisplayId } from "@/lib/db/display-id";
import {
  buildTrajetName,
  trajetSignature,
  recurrenceDays,
  dayBeforeStr,
} from "./helpers";
import {
  resolveScheduleAnchor,
  type EtablissementSchedules,
} from "./schedule-anchor";
import { autoCreateEtablissementArret, addUsagerArret } from "./arrets";
import type { TrajetSyncCtx } from "./types";

/**
 * VERSIONS a circuit's trajets at an effective date (Transcolaire model): an
 * avenant does not reuse the base trajet, it creates NEW ones, dated from D
 * and owned by the avenant. The old trajet (previous composition) is closed at
 * D-1 (`endDate`), its open arrets bounded at D-1. Each version therefore has
 * its own route/km (to recompute) — that is the before/after difference.
 *
 * The new composition is read from the ASSIGNMENTS active at D (source of
 * truth): grouped by (direction × set of days) → one trajet per group, with
 * one arret per usager (+ the etablissement arret), all `valid_from = D`.
 */
export async function regenerateCircuitTrajets(
  ctx: TrajetSyncCtx,
  circuitId: string,
  effectiveDate: string,
  createdByAvenantId: string | null,
) {
  const endOld = dayBeforeStr(effectiveDate);

  // 1. Composition active at D (open assignments covering that date).
  const affectations = await ctx.db
    .select({
      usagerAddressId: usagerCircuits.usagerAddressId,
      daysAller: usagerCircuits.daysAller,
      daysRetour: usagerCircuits.daysRetour,
    })
    .from(usagerCircuits)
    .where(
      and(
        eq(usagerCircuits.circuitId, circuitId),
        eq(usagerCircuits.tenantId, ctx.tenantId),
        isNull(usagerCircuits.deletedAt),
        or(
          isNull(usagerCircuits.validFrom),
          lte(usagerCircuits.validFrom, effectiveDate),
        ),
        or(
          isNull(usagerCircuits.validTo),
          gte(usagerCircuits.validTo, effectiveDate),
        ),
      ),
    );

  // 2. Close the trajets active at D (endDate = D-1) + bound their open arrets.
  // direction/recurrence are captured to find each trajet's successor (same
  // signature) and migrate its occurrences to it.
  const activeTrajets = await ctx.db
    .select({
      id: trajets.id,
      direction: trajets.direction,
      recurrence: trajets.recurrence,
    })
    .from(trajets)
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        isNull(trajets.deletedAt),
        or(isNull(trajets.startDate), lte(trajets.startDate, effectiveDate)),
        or(isNull(trajets.endDate), gte(trajets.endDate, effectiveDate)),
      ),
    );
  const activeIds = activeTrajets.map((t) => t.id);
  if (activeIds.length > 0) {
    await ctx.db
      .update(trajets)
      .set({ endDate: endOld, updatedAt: new Date() })
      .where(
        and(
          inArray(trajets.id, activeIds),
          eq(trajets.tenantId, ctx.tenantId),
        ),
      );
    await ctx.db
      .update(arrets)
      .set({ validTo: endOld, updatedAt: new Date() })
      .where(
        and(
          inArray(arrets.trajetId, activeIds),
          eq(arrets.tenantId, ctx.tenantId),
          isNull(arrets.deletedAt),
          isNull(arrets.validTo),
        ),
      );
  }

  // 3. Group the composition by (direction × set of days).
  const groups = new Map<
    string,
    { direction: string; days: DayEntry[]; addressIds: string[] }
  >();
  for (const aff of affectations) {
    if (!aff.usagerAddressId) continue;
    const perDir: [string, DayEntry[]][] = [
      ["aller", normalizeDays(aff.daysAller)],
      ["retour", normalizeDays(aff.daysRetour)],
    ];
    for (const [direction, days] of perDir) {
      if (days.length === 0) continue;
      const sorted = [...days].sort((a, b) => a.day - b.day);
      const key = `${direction}|${formatDaysShort(sorted)}`;
      const existing = groups.get(key);
      if (existing) existing.addressIds.push(aff.usagerAddressId);
      else
        groups.set(key, {
          direction,
          days: sorted,
          addressIds: [aff.usagerAddressId],
        });
    }
  }
  if (groups.size === 0) return;

  // Etablissement schedules (anchor of each trajet).
  const etabRows = await ctx.db
    .select({ schedules: etablissements.schedules })
    .from(circuits)
    .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
    .limit(1);
  const schedules = (etabRows[0]?.schedules as EtablissementSchedules) ?? null;

  // 4. Create each dated trajet (startDate = D) + etablissement arret + usager arrets.
  const newBySignature = new Map<string, string>();
  for (const g of groups.values()) {
    const name = buildTrajetName(g.direction, g.days);
    const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "trajets");
    const departureTime = resolveScheduleAnchor(schedules, g.direction, g.days);
    const inserted = await ctx.db
      .insert(trajets)
      .values({
        tenantId: ctx.tenantId,
        displayId,
        circuitId,
        createdByAvenantId,
        name,
        direction: g.direction,
        departureTime,
        recurrence: { frequency: "weekly" as const, daysOfWeek: g.days },
        startDate: effectiveDate,
      })
      .returning();
    const created = inserted[0];
    if (!created) continue;
    newBySignature.set(trajetSignature(g.direction, g.days), created.id);
    await autoCreateEtablissementArret(ctx, created.id, circuitId, departureTime);
    for (const addressId of g.addressIds) {
      await addUsagerArret(ctx, created.id, addressId, effectiveDate);
    }
  }

  // 5. Migrate the upcoming occurrences (date ≥ D) of each closed trajet to
  // its successor with the same signature: one-off customizations (chauffeur,
  // vehicule, time, status, notes) thus survive the avenant. Without a
  // successor (composition gone), the occurrences stay on the closed trajet —
  // outside the effectivity window, hence invisible in the planning.
  for (const old of activeTrajets) {
    const successorId = newBySignature.get(
      trajetSignature(old.direction, recurrenceDays(old.recurrence)),
    );
    if (!successorId || successorId === old.id) continue;
    await ctx.db
      .update(trajetOccurrences)
      .set({ trajetId: successorId, updatedAt: new Date() })
      .where(
        and(
          eq(trajetOccurrences.trajetId, old.id),
          eq(trajetOccurrences.tenantId, ctx.tenantId),
          gte(trajetOccurrences.date, effectiveDate),
        ),
      );
  }
}

/**
 * CANCELS an avenant's versioning (inverse of `regenerateCircuitTrajets`):
 * - soft-delete the trajets THIS AVENANT created (createdByAvenantId) + their arrets;
 * - REOPENS the trajets it had closed at D-1 (endDate set back to null) + their
 *   arrets (valid_to set back to null).
 * Called when cancelling/deleting an avenant to restore the previous composition.
 *
 * ⚠ Reliable for 1 avenant at a given date (common case: merging guarantees a
 * single avenant per (circuit, date)). For CHAINS of nested avenants, reopening
 * by date remains approximate — eventually, a declarative rebuild.
 */
export async function revertAvenantVersioning(
  ctx: TrajetSyncCtx,
  circuitId: string,
  effectiveDate: string,
  avenantId: string,
) {
  const now = new Date();
  const endOld = dayBeforeStr(effectiveDate);

  // 1. Trajets VERSIONED by this avenant → soft-delete (with their arrets).
  // The `startDate = D` filter = regenerateCircuitTrajets' signature: we only
  // touch dated snapshots. Trajets created by a manual avenant via
  // syncTrajetForDirection have a null startDate → excluded (otherwise the
  // usager would be stranded). Makes the reversion a safe no-op for
  // non-versioned avenants.
  const created = await ctx.db
    .select({
      id: trajets.id,
      direction: trajets.direction,
      recurrence: trajets.recurrence,
    })
    .from(trajets)
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        eq(trajets.createdByAvenantId, avenantId),
        eq(trajets.startDate, effectiveDate),
        isNull(trajets.deletedAt),
      ),
    );
  const createdIds = created.map((t) => t.id);
  if (createdIds.length > 0) {
    await ctx.db
      .update(arrets)
      .set({ deletedAt: now })
      .where(
        and(
          inArray(arrets.trajetId, createdIds),
          eq(arrets.tenantId, ctx.tenantId),
          isNull(arrets.deletedAt),
        ),
      );
    await ctx.db
      .update(trajets)
      .set({ deletedAt: now })
      .where(
        and(
          inArray(trajets.id, createdIds),
          eq(trajets.tenantId, ctx.tenantId),
        ),
      );
  }

  // 2. Reopen the trajets this avenant had closed at D-1.
  const reopened = await ctx.db
    .update(trajets)
    .set({ endDate: null, updatedAt: now })
    .where(
      and(
        eq(trajets.circuitId, circuitId),
        eq(trajets.tenantId, ctx.tenantId),
        eq(trajets.endDate, endOld),
        isNull(trajets.deletedAt),
      ),
    )
    .returning({
      id: trajets.id,
      direction: trajets.direction,
      recurrence: trajets.recurrence,
    });
  const reopenedIds = reopened.map((t) => t.id);
  if (reopenedIds.length > 0) {
    await ctx.db
      .update(arrets)
      .set({ validTo: null, updatedAt: now })
      .where(
        and(
          inArray(arrets.trajetId, reopenedIds),
          eq(arrets.tenantId, ctx.tenantId),
          eq(arrets.validTo, endOld),
          isNull(arrets.deletedAt),
        ),
      );
  }

  // 3. Re-migrate the occurrences (date ≥ D) of the avenant's trajets to the
  // reopened trajet with the same signature, so that one-off customizations
  // also survive the cancellation. On date collision (the reopened trajet
  // already had an occurrence): a customized source replaces a pristine
  // target; otherwise the existing target is kept and the source stays on the
  // deleted trajet (invisible).
  const reopenedBySignature = new Map<string, string>();
  for (const t of reopened) {
    reopenedBySignature.set(
      trajetSignature(t.direction, recurrenceDays(t.recurrence)),
      t.id,
    );
  }
  for (const source of created) {
    const targetId = reopenedBySignature.get(
      trajetSignature(source.direction, recurrenceDays(source.recurrence)),
    );
    if (!targetId || targetId === source.id) continue;

    const personalized = or(
      isNotNull(trajetOccurrences.chauffeurId),
      isNotNull(trajetOccurrences.vehiculeId),
      isNotNull(trajetOccurrences.departureTime),
      isNotNull(trajetOccurrences.notes),
      ne(trajetOccurrences.status, "planifie"),
    );

    const personalizedSources = await ctx.db
      .select({ date: trajetOccurrences.date })
      .from(trajetOccurrences)
      .where(
        and(
          eq(trajetOccurrences.trajetId, source.id),
          eq(trajetOccurrences.tenantId, ctx.tenantId),
          gte(trajetOccurrences.date, effectiveDate),
          personalized,
        ),
      );
    const personalizedDates = personalizedSources.map((o) => o.date);
    if (personalizedDates.length > 0) {
      await ctx.db
        .delete(trajetOccurrences)
        .where(
          and(
            eq(trajetOccurrences.trajetId, targetId),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
            inArray(trajetOccurrences.date, personalizedDates),
          ),
        );
    }

    const remaining = await ctx.db
      .select({ date: trajetOccurrences.date })
      .from(trajetOccurrences)
      .where(
        and(
          eq(trajetOccurrences.trajetId, targetId),
          eq(trajetOccurrences.tenantId, ctx.tenantId),
          gte(trajetOccurrences.date, effectiveDate),
        ),
      );
    const blockedDates = remaining.map((o) => o.date);
    await ctx.db
      .update(trajetOccurrences)
      .set({ trajetId: targetId, updatedAt: now })
      .where(
        and(
          eq(trajetOccurrences.trajetId, source.id),
          eq(trajetOccurrences.tenantId, ctx.tenantId),
          gte(trajetOccurrences.date, effectiveDate),
          ...(blockedDates.length > 0
            ? [notInArray(trajetOccurrences.date, blockedDates)]
            : []),
        ),
      );
  }
}

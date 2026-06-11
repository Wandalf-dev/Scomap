import { eq, and, isNull } from "drizzle-orm";
import { circuits, etablissements, trajets } from "@scomap/db/schema";
import {
  normalizeDays,
  areDayEntriesEqual,
  type DayEntry,
} from "@/lib/types/day-entry";
import { nextDisplayId } from "@/lib/db/display-id";
import { buildTrajetName } from "./helpers";
import {
  resolveScheduleAnchor,
  type EtablissementSchedules,
} from "./schedule-anchor";
import { autoCreateEtablissementArret, addUsagerArret } from "./arrets";
import type { TrajetSyncCtx } from "./types";

export async function syncTrajetForDirection(
  ctx: TrajetSyncCtx,
  circuitId: string,
  direction: string,
  days: DayEntry[],
  usagerAddressId: string,
  validFrom: string | null = null,
  createdByAvenantId: string | null = null,
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
    const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "trajets");
    // Reference time derived from the establishment's schedules (direction + days).
    const etabRows = await ctx.db
      .select({ schedules: etablissements.schedules })
      .from(circuits)
      .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
      .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
      .limit(1);
    const departureTime = resolveScheduleAnchor(
      (etabRows[0]?.schedules as EtablissementSchedules) ?? null,
      direction,
      sortedDays,
    );
    const result = await ctx.db
      .insert(trajets)
      .values({
        tenantId: ctx.tenantId,
        displayId,
        circuitId,
        createdByAvenantId,
        name,
        direction,
        departureTime,
        recurrence: { frequency: "weekly" as const, daysOfWeek: sortedDays },
      })
      .returning();

    const created = result[0];
    if (created) {
      await autoCreateEtablissementArret(
        ctx,
        created.id,
        circuitId,
        departureTime,
      );
      await addUsagerArret(ctx, created.id, usagerAddressId, validFrom);
    }
  }
}

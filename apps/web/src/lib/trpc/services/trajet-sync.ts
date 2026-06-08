import { eq, and, isNull, inArray, or, lte, gte, sql } from "drizzle-orm";
import {
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  usagerCircuits,
  trajets,
  arrets,
} from "@scomap/db/schema";
import {
  normalizeDays,
  areDayEntriesEqual,
  formatDaysShort,
  type DayEntry,
} from "@/lib/types/day-entry";
import { nextDisplayId } from "@/lib/db/display-id";

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

// jour ISO (1=lundi … 7=dimanche) -> clé des horaires établissement.
const SCHEDULE_DAY_KEYS = [
  "",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

export type EtablissementSchedules = Record<
  string,
  { morning?: string | null; evening?: string | null } | null
> | null;

/**
 * Heure de référence d'un trajet déduite des horaires de l'établissement :
 * matin (ouverture) pour un aller, soir (fermeture) pour un retour. On prend
 * le premier jour de la récurrence ayant une valeur, sinon n'importe quel jour.
 */
export function resolveScheduleAnchor(
  schedules: EtablissementSchedules,
  direction: string,
  days: DayEntry[],
): string | null {
  if (!schedules) return null;
  const slot = direction === "aller" ? "morning" : "evening";
  const ordered = [...days.map((d) => d.day)].sort((a, b) => a - b);
  for (const d of ordered) {
    const t = schedules[SCHEDULE_DAY_KEYS[d] ?? ""]?.[slot];
    if (t) return t;
  }
  for (let d = 1; d <= 7; d++) {
    const t = schedules[SCHEDULE_DAY_KEYS[d]!]?.[slot];
    if (t) return t;
  }
  return null;
}

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
    // Horaire école = ancre verrouillée (les horaires de PEC s'en déduisent).
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

  // Get max orderIndex on this trajet
  const maxResult = await ctx.db
    .select({ maxIdx: sql<number>`coalesce(max(${arrets.orderIndex}), 0)` })
    .from(arrets)
    .where(
      and(
        eq(arrets.tenantId, ctx.tenantId),
        eq(arrets.trajetId, trajetId),
        isNull(arrets.deletedAt),
      ),
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
    // Heure de référence déduite des horaires de l'établissement (sens + jours).
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

/** Date du jour précédent (chaîne YYYY-MM-DD). */
function dayBeforeStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * VERSIONNE les trajets d'un circuit à une date d'effet (modèle Transcolaire) :
 * un avenant ne réutilise pas le trajet de base, il en crée de NOUVEAUX, datés
 * depuis J et possédés par l'avenant. L'ancien trajet (composition précédente)
 * est clôturé à J-1 (`endDate`), ses arrêts ouverts bornés à J-1. Chaque version
 * a donc sa propre route/km (à recalculer) — c'est la différence avant/après.
 *
 * La nouvelle composition est lue depuis les AFFECTATIONS actives à J (source de
 * vérité) : on regroupe par (sens × jeu de jours) → un trajet par groupe, avec
 * un arrêt par usager (+ l'arrêt établissement), tous `valid_from = J`.
 */
export async function regenerateCircuitTrajets(
  ctx: TrajetSyncCtx,
  circuitId: string,
  effectiveDate: string,
  createdByAvenantId: string | null,
) {
  const endOld = dayBeforeStr(effectiveDate);

  // 1. Composition active à J (affectations ouvertes couvrant cette date).
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

  // 2. Clôt les trajets actifs à J (endDate = J-1) + borne leurs arrêts ouverts.
  const activeTrajets = await ctx.db
    .select({ id: trajets.id })
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

  // 3. Regroupe la composition par (sens × jeu de jours).
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

  // Horaires établissement (ancre de chaque trajet).
  const etabRows = await ctx.db
    .select({ schedules: etablissements.schedules })
    .from(circuits)
    .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
    .limit(1);
  const schedules = (etabRows[0]?.schedules as EtablissementSchedules) ?? null;

  // 4. Crée chaque trajet daté (startDate = J) + arrêt établissement + arrêts usagers.
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
    await autoCreateEtablissementArret(ctx, created.id, circuitId, departureTime);
    for (const addressId of g.addressIds) {
      await addUsagerArret(ctx, created.id, addressId, effectiveDate);
    }
  }
}

/**
 * ANNULE le versioning d'un avenant (inverse de `regenerateCircuitTrajets`) :
 * - soft-delete les trajets QUE CET AVENANT a créés (createdByAvenantId) + leurs arrêts ;
 * - ROUVRE les trajets qu'il avait clôturés à J-1 (endDate repassé à null) + leurs
 *   arrêts (valid_to repassé à null).
 * Appelé quand on annule/supprime un avenant pour restaurer la composition d'avant.
 *
 * ⚠ Fiable pour 1 avenant à une date donnée (cas courant : la fusion garantit un
 * seul avenant par (circuit, date)). Pour des CHAÎNES d'avenants imbriqués, la
 * réouverture par date reste approximative — à terme, rebuild déclaratif.
 */
export async function revertAvenantVersioning(
  ctx: TrajetSyncCtx,
  circuitId: string,
  effectiveDate: string,
  avenantId: string,
) {
  const now = new Date();
  const endOld = dayBeforeStr(effectiveDate);

  // 1. Trajets VERSIONNÉS par cet avenant → soft-delete (avec leurs arrêts).
  // Filtre `startDate = J` = signature de regenerateCircuitTrajets : on ne touche
  // QUE les snapshots datés. Les trajets créés par un avenant manuel via
  // syncTrajetForDirection ont startDate null → exclus (sinon on stranderait
  // l'usager). Rend la réversion no-op sûr pour les avenants non versionnés.
  const created = await ctx.db
    .select({ id: trajets.id })
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

  // 2. Rouvre les trajets que cet avenant avait clôturés à J-1.
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
    .returning({ id: trajets.id });
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
  const trajetIds = circuitTrajets.map((t) => t.id);
  if (trajetIds.length === 0) return;

  // Borne en un seul UPDATE tous les arrêts ouverts de cette adresse.
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

  // 1. Soft-delete en un seul UPDATE les arrêts de cette adresse.
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

  // 2. Trajets qui ont encore au moins un arrêt usager actif.
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

  // 3. Soft-delete les trajets devenus vides, en un seul UPDATE.
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

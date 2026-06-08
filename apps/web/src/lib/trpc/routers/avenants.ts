import { z } from "zod";
import { eq, and, or, isNull, desc, inArray, sql } from "drizzle-orm";
import {
  avenants,
  avenantChanges,
  usagers,
  usagerCircuits,
  usagerAddresses,
  circuits,
  etablissements,
  type AvenantSnapshot,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import { nextDisplayId } from "@/lib/db/display-id";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import { avenantCreateSchema } from "@/lib/validators/avenant";
import {
  isCircuitCompatibleTransport,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import {
  syncTrajetForDirection,
  endUsagerArretsAt,
  revertAvenantVersioning,
  type TrajetSyncCtx,
} from "../services/trajet-sync";

type Ctx = TrajetSyncCtx;
type ChangeRow = typeof avenantChanges.$inferSelect;

// ── Snapshot capture (état AVANT) ───────────────────────────────────
async function capturePrevious(
  ctx: Ctx,
  change: {
    type: string;
    usagerId: string;
    usagerCircuitId?: string | null;
  },
): Promise<AvenantSnapshot | null> {
  if (change.type === "etablissement") {
    const rows = await ctx.db
      .select({
        etablissementId: usagers.etablissementId,
        secondaryEtablissementId: usagers.secondaryEtablissementId,
      })
      .from(usagers)
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      )
      .limit(1);
    const u = rows[0];
    if (!u) return null;
    const names = await resolveEtabNames(ctx, [
      u.etablissementId,
      u.secondaryEtablissementId,
    ]);
    return {
      etablissementId: u.etablissementId,
      etablissementName: names.get(u.etablissementId ?? "") ?? null,
      secondaryEtablissementId: u.secondaryEtablissementId,
      secondaryEtablissementName:
        names.get(u.secondaryEtablissementId ?? "") ?? null,
    };
  }

  if (change.type === "type_transport") {
    const rows = await ctx.db
      .select({ transportType: usagers.transportType })
      .from(usagers)
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      )
      .limit(1);
    const t = rows[0]?.transportType ?? null;
    return {
      transportType: t,
      transportTypeLabel: t
        ? USAGER_TRANSPORT_TYPE_LABELS[
            t as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
          ] ?? t
        : null,
    };
  }

  if (!change.usagerCircuitId) return null;
  const ucRows = await ctx.db
    .select({
      circuitId: usagerCircuits.circuitId,
      usagerAddressId: usagerCircuits.usagerAddressId,
      circuitName: circuits.name,
    })
    .from(usagerCircuits)
    .innerJoin(circuits, eq(usagerCircuits.circuitId, circuits.id))
    .where(
      and(
        eq(usagerCircuits.id, change.usagerCircuitId),
        eq(usagerCircuits.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);
  const uc = ucRows[0];
  if (!uc) return null;

  if (change.type === "circuit") {
    return {
      circuitId: uc.circuitId,
      circuitName: uc.circuitName,
      usagerAddressId: uc.usagerAddressId,
    };
  }

  if (change.type === "jours_pec") {
    const days = await readAddressDays(ctx, uc.usagerAddressId);
    return {
      circuitId: uc.circuitId,
      daysAller: days.daysAller,
      daysRetour: days.daysRetour,
    };
  }

  // adresse
  if (!uc.usagerAddressId) {
    return {
      usagerAddressId: "",
      address: null,
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
      type: null,
    };
  }
  const a = await readAddress(ctx, uc.usagerAddressId);
  return {
    usagerAddressId: uc.usagerAddressId,
    address: a?.address ?? null,
    city: a?.city ?? null,
    postalCode: a?.postalCode ?? null,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
    type: a?.type ?? null,
  };
}

// ── Construction du snapshot APRÈS depuis l'input ───────────────────
async function buildNewValue(
  ctx: Ctx,
  change: z.infer<typeof avenantCreateSchema>["changes"][number],
): Promise<AvenantSnapshot> {
  if (change.type === "etablissement") {
    const names = await resolveEtabNames(ctx, [
      change.etablissementId,
      change.secondaryEtablissementId ?? null,
    ]);
    return {
      etablissementId: change.etablissementId,
      etablissementName: names.get(change.etablissementId ?? "") ?? null,
      secondaryEtablissementId: change.secondaryEtablissementId ?? null,
      secondaryEtablissementName:
        names.get(change.secondaryEtablissementId ?? "") ?? null,
    };
  }
  if (change.type === "type_transport") {
    return {
      transportType: change.transportType,
      transportTypeLabel:
        USAGER_TRANSPORT_TYPE_LABELS[
          change.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
        ] ?? change.transportType,
    };
  }
  if (change.type === "circuit") {
    const c = await ctx.db
      .select({ name: circuits.name })
      .from(circuits)
      .where(
        and(
          eq(circuits.id, change.circuitId),
          eq(circuits.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);
    return {
      circuitId: change.circuitId,
      circuitName: c[0]?.name ?? null,
      usagerAddressId: change.usagerAddressId ?? null,
    };
  }
  if (change.type === "jours_pec") {
    // circuitId résolu depuis l'affectation ciblée
    const uc = await ctx.db
      .select({ circuitId: usagerCircuits.circuitId })
      .from(usagerCircuits)
      .where(
        and(
          eq(usagerCircuits.id, change.usagerCircuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);
    return {
      circuitId: uc[0]?.circuitId ?? "",
      daysAller: change.daysAller,
      daysRetour: change.daysRetour,
    };
  }
  // adresse
  const a = await readAddress(ctx, change.usagerAddressId);
  return {
    usagerAddressId: change.usagerAddressId,
    address: a?.address ?? null,
    city: a?.city ?? null,
    postalCode: a?.postalCode ?? null,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
    type: a?.type ?? null,
  };
}

// ── Application d'un changement — VERSIONING DATÉ (zéro trigger) ─────
// On ne mute jamais l'état courant : on clôt la version active à J-1 et on
// ouvre une nouvelle version à partir de la date d'effet. L'ancienne et la
// nouvelle coexistent, bornées par dates ; la planification résout par date.
async function applyChange(
  ctx: Ctx,
  change: ChangeRow,
  effectiveDate: string,
): Promise<void> {
  const nv = change.newValue;
  if (!nv) return;

  // Établissement = attribut administratif de l'usager (pas une affectation
  // datée) : appliqué directement sur la fiche usager.
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

  // Type de transport = attribut de l'usager. On l'applique directement ; si le
  // nouveau mode n'est pas un mode "circuit" (famille / transport en commun),
  // on clôt à J-1 toutes les affectations circuit actives (le circuit "saute").
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
        // Clôt la version d'affectation à J-1 (pas de nouvelle version : plus de circuit).
        await ctx.db
          .update(usagerCircuits)
          .set({ validTo: endOld, updatedAt: new Date() })
          .where(
            and(
              eq(usagerCircuits.id, uc.id),
              eq(usagerCircuits.tenantId, ctx.tenantId),
            ),
          );
        // Borne les arrêts de l'usager sur ce circuit à J-1.
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
  // On ne version que depuis une version OUVERTE et non supprimée.
  if (!old || old.validTo || old.deletedAt) return;

  // Valeurs de la nouvelle version : héritées de l'ancienne, sauf le champ changé.
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

  // Jours vides (anciennes données) → retombe sur l'adresse cible.
  if (daysAller.length === 0 && daysRetour.length === 0 && newAddressId) {
    const ad = await readAddressDays(ctx, newAddressId);
    daysAller = ad.daysAller;
    daysRetour = ad.daysRetour;
  }

  const endOld = dayBefore(effectiveDate);

  // 1. Clôt la version courante à J-1.
  await ctx.db
    .update(usagerCircuits)
    .set({ validTo: endOld, updatedAt: new Date() })
    .where(
      and(
        eq(usagerCircuits.id, old.id),
        eq(usagerCircuits.tenantId, ctx.tenantId),
      ),
    );

  // 2. Ouvre la nouvelle version à partir de la date d'effet.
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
  });

  // 3. Borne les arrêts de l'ancienne affectation à J-1.
  if (old.usagerAddressId) {
    await endUsagerArretsAt(ctx, old.circuitId, old.usagerAddressId, endOld);
  }
  // 4. Crée les arrêts de la nouvelle affectation à partir de la date d'effet.
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

// ── Helpers de lecture ──────────────────────────────────────────────
async function resolveEtabNames(
  ctx: Ctx,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const valid = ids.filter((id): id is string => !!id);
  const map = new Map<string, string>();
  if (valid.length === 0) return map;
  // Filtre tenant + inArray : ne lit que les établissements du tenant ciblés
  // (corrige une fuite cross-tenant ET un scan de table complet).
  const rows = await ctx.db
    .select({ id: etablissements.id, name: etablissements.name })
    .from(etablissements)
    .where(
      and(
        eq(etablissements.tenantId, ctx.tenantId),
        inArray(etablissements.id, valid),
      ),
    );
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

async function readAddress(ctx: Ctx, addressId: string) {
  const rows = await ctx.db
    .select({
      address: usagerAddresses.address,
      city: usagerAddresses.city,
      postalCode: usagerAddresses.postalCode,
      latitude: usagerAddresses.latitude,
      longitude: usagerAddresses.longitude,
      type: usagerAddresses.type,
    })
    .from(usagerAddresses)
    .where(
      and(
        eq(usagerAddresses.id, addressId),
        eq(usagerAddresses.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function readAddressDays(
  ctx: Ctx,
  addressId: string | null,
): Promise<{ daysAller: DayEntry[]; daysRetour: DayEntry[] }> {
  if (!addressId) return { daysAller: [], daysRetour: [] };
  const rows = await ctx.db
    .select({
      daysAller: usagerAddresses.daysAller,
      daysRetour: usagerAddresses.daysRetour,
    })
    .from(usagerAddresses)
    .where(
      and(
        eq(usagerAddresses.id, addressId),
        eq(usagerAddresses.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);
  return {
    daysAller: normalizeDays(rows[0]?.daysAller),
    daysRetour: normalizeDays(rows[0]?.daysRetour),
  };
}

async function syncTrajets(
  ctx: Ctx,
  circuitId: string,
  days: { daysAller: DayEntry[]; daysRetour: DayEntry[] },
  usagerAddressId: string,
  validFrom: string | null = null,
  createdByAvenantId: string | null = null,
) {
  if (days.daysAller.length > 0) {
    await syncTrajetForDirection(ctx, circuitId, "aller", days.daysAller, usagerAddressId, validFrom, createdByAvenantId);
  }
  if (days.daysRetour.length > 0) {
    await syncTrajetForDirection(ctx, circuitId, "retour", days.daysRetour, usagerAddressId, validFrom, createdByAvenantId);
  }
}

/** Date du jour précédent (chaîne YYYY-MM-DD). */
function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** ISO (YYYY-MM-DD) → JJ/MM/AAAA pour les messages d'erreur. */
function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Garde : la date d'effet doit tomber dans la fenêtre de validité du circuit
// ET de chaque usager concerné. Les comparaisons sont lexicographiques (le
// format ISO YYYY-MM-DD est chronologiquement ordonné). Une borne nulle = pas
// de contrainte de ce côté. C'est la garde DURE (le client ne fait que doubler).
async function assertEffectiveDateWithinBounds(
  ctx: Ctx,
  input: z.infer<typeof avenantCreateSchema>,
): Promise<void> {
  const eff = input.effectiveDate;

  // Circuits à contrôler : l'entête (circuit courant de l'affectation) + le
  // nouveau circuit d'un éventuel changement de circuit (la nouvelle version
  // d'affectation y démarre à la date d'effet).
  const circuitIds = new Set<string>();
  if (input.circuitId) circuitIds.add(input.circuitId);
  for (const c of input.changes) {
    if (c.type === "circuit") circuitIds.add(c.circuitId);
  }

  if (circuitIds.size > 0) {
    const rows = await ctx.db
      .select({
        name: circuits.name,
        startDate: circuits.startDate,
        endDate: circuits.endDate,
      })
      .from(circuits)
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          inArray(circuits.id, [...circuitIds]),
        ),
      );
    for (const c of rows) {
      if (c.startDate && eff < c.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La date d'effet (${frDate(eff)}) précède le début du circuit « ${c.name} » (${frDate(c.startDate)}).`,
        });
      }
      if (c.endDate && eff > c.endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La date d'effet (${frDate(eff)}) dépasse la fin du circuit « ${c.name} » (${frDate(c.endDate)}).`,
        });
      }
    }
  }

  // Usagers concernés par les changements.
  const usagerIds = [...new Set(input.changes.map((c) => c.usagerId))];
  if (usagerIds.length > 0) {
    const rows = await ctx.db
      .select({
        firstName: usagers.firstName,
        lastName: usagers.lastName,
        start: usagers.transportStartDate,
        end: usagers.transportEndDate,
      })
      .from(usagers)
      .where(
        and(eq(usagers.tenantId, ctx.tenantId), inArray(usagers.id, usagerIds)),
      );
    for (const u of rows) {
      const who = `${u.firstName} ${u.lastName}`;
      if (u.start && eff < u.start) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La date d'effet (${frDate(eff)}) précède le début de transport de ${who} (${frDate(u.start)}).`,
        });
      }
      if (u.end && eff > u.end) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La date d'effet (${frDate(eff)}) dépasse la fin de transport de ${who} (${frDate(u.end)}).`,
        });
      }
    }
  }
}

async function assertAvenantOwned(ctx: Ctx, id: string) {
  const rows = await ctx.db
    .select()
    .from(avenants)
    .where(
      and(
        eq(avenants.id, id),
        eq(avenants.tenantId, ctx.tenantId),
        isNull(avenants.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Avenant non trouvé" });
  }
  return rows[0];
}

// ── Router ──────────────────────────────────────────────────────────
export const avenantsRouter = createTRPCRouter({
  listByUsager: tenantProcedure
    .input(z.object({ usagerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Circuits sur lesquels l'usager est affecté (versions ouvertes).
      const circuitRows = await ctx.db
        .select({ circuitId: usagerCircuits.circuitId })
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.usagerId, input.usagerId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        );
      const circuitIds = [...new Set(circuitRows.map((r) => r.circuitId))];

      // Visibles pour cet usager : SES propres changements OU tout avenant portant
      // sur un circuit auquel il est affecté (même si le sujet est un AUTRE usager
      // du circuit — important pour voir l'historique partagé du circuit). On joint
      // les usagers pour afficher de qui est chaque changement.
      const visibleFilter =
        circuitIds.length > 0
          ? or(
              eq(avenantChanges.usagerId, input.usagerId),
              inArray(avenants.circuitId, circuitIds),
            )
          : eq(avenantChanges.usagerId, input.usagerId);

      const rows = await ctx.db
        .select({
          changeId: avenantChanges.id,
          type: avenantChanges.type,
          previousValue: avenantChanges.previousValue,
          newValue: avenantChanges.newValue,
          usagerCircuitId: avenantChanges.usagerCircuitId,
          usagerId: avenantChanges.usagerId,
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
          avenantId: avenants.id,
          displayId: avenants.displayId,
          circuitSequence: avenants.circuitSequence,
          circuitId: avenants.circuitId,
          circuitCode: circuits.code,
          circuitName: circuits.name,
          circuitStartDate: circuits.startDate,
          effectiveDate: avenants.effectiveDate,
          endDate: avenants.endDate,
          reason: avenants.reason,
          status: avenants.status,
          appliedAt: avenants.appliedAt,
          createdAt: avenants.createdAt,
        })
        .from(avenantChanges)
        .innerJoin(avenants, eq(avenantChanges.avenantId, avenants.id))
        .innerJoin(usagers, eq(avenantChanges.usagerId, usagers.id))
        .leftJoin(circuits, eq(avenants.circuitId, circuits.id))
        .where(
          and(
            eq(avenants.tenantId, ctx.tenantId),
            isNull(avenants.deletedAt),
            visibleFilter,
          ),
        )
        .orderBy(desc(avenants.effectiveDate), desc(avenants.createdAt));
      return rows;
    }),

  listByCircuit: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const headers = await ctx.db
        .select({
          id: avenants.id,
          displayId: avenants.displayId,
          circuitSequence: avenants.circuitSequence,
          effectiveDate: avenants.effectiveDate,
          endDate: avenants.endDate,
          reason: avenants.reason,
          status: avenants.status,
          appliedAt: avenants.appliedAt,
          createdAt: avenants.createdAt,
        })
        .from(avenants)
        .where(
          and(
            eq(avenants.circuitId, input.circuitId),
            eq(avenants.tenantId, ctx.tenantId),
            isNull(avenants.deletedAt),
          ),
        )
        .orderBy(desc(avenants.effectiveDate), desc(avenants.createdAt));

      if (headers.length === 0) return [];

      // Détail des changements (par usager) de ces avenants.
      const changes = await ctx.db
        .select({
          changeId: avenantChanges.id,
          avenantId: avenantChanges.avenantId,
          type: avenantChanges.type,
          previousValue: avenantChanges.previousValue,
          newValue: avenantChanges.newValue,
          usagerId: avenantChanges.usagerId,
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
        })
        .from(avenantChanges)
        .innerJoin(usagers, eq(avenantChanges.usagerId, usagers.id))
        .where(
          and(
            inArray(
              avenantChanges.avenantId,
              headers.map((h) => h.id),
            ),
            eq(avenantChanges.tenantId, ctx.tenantId),
          ),
        );

      type ChangeRowOut = (typeof changes)[number];
      const byAvenant = new Map<string, ChangeRowOut[]>();
      for (const c of changes) {
        const arr = byAvenant.get(c.avenantId) ?? [];
        arr.push(c);
        byAvenant.set(c.avenantId, arr);
      }

      return headers.map((h) => ({
        ...h,
        changes: byAvenant.get(h.id) ?? [],
      }));
    }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const header = await assertAvenantOwned(ctx, input.id);
      const changes = await ctx.db
        .select()
        .from(avenantChanges)
        .where(eq(avenantChanges.avenantId, input.id));
      return { ...header, changes };
    }),

  create: tenantProcedure
    .input(avenantCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Garde dates : la date d'effet doit respecter les bornes du circuit et
      // des usagers (début/fin de transport) — sinon on créerait une version
      // d'affectation hors période.
      await assertEffectiveDateWithinBounds(ctx, input);

      // Fusion automatique : si un avenant (non annulé) existe déjà sur le même
      // circuit à la même date d'effet, on RATTACHE les changements à cet avenant
      // plutôt que d'en créer un nouveau. Permet de regrouper plusieurs usagers
      // d'un même circuit modifiés le même jour sous un seul « Avenant n°N ».
      let existing: typeof avenants.$inferSelect | null = null;
      if (input.circuitId) {
        const found = await ctx.db
          .select()
          .from(avenants)
          .where(
            and(
              eq(avenants.circuitId, input.circuitId),
              eq(avenants.effectiveDate, input.effectiveDate),
              eq(avenants.tenantId, ctx.tenantId),
              isNull(avenants.deletedAt),
            ),
          )
          .limit(1);
        existing = found[0] ?? null;
      }

      let avenant: typeof avenants.$inferSelect;
      if (existing) {
        avenant = existing;
        // Anti-doublon : un même usager ne peut pas avoir deux fois le même type
        // de changement sur le même avenant (sinon double application).
        const prior = await ctx.db
          .select({
            usagerId: avenantChanges.usagerId,
            type: avenantChanges.type,
          })
          .from(avenantChanges)
          .where(eq(avenantChanges.avenantId, avenant.id));
        const seen = new Set(prior.map((c) => `${c.usagerId}:${c.type}`));
        for (const change of input.changes) {
          if (seen.has(`${change.usagerId}:${change.type}`)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Un changement de ce type pour cet usager existe déjà sur l'avenant de cette date.",
            });
          }
        }
      } else {
        const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "avenants");
        // N° d'avenant DANS le circuit (séquence propre au circuit).
        let circuitSequence: number | null = null;
        if (input.circuitId) {
          const seq = await ctx.db
            .select({
              max: sql<number>`coalesce(max(${avenants.circuitSequence}), 0)`,
            })
            .from(avenants)
            .where(
              and(
                eq(avenants.circuitId, input.circuitId),
                eq(avenants.tenantId, ctx.tenantId),
              ),
            );
          circuitSequence = (seq[0]?.max ?? 0) + 1;
        }

        const inserted = await ctx.db
          .insert(avenants)
          .values({
            tenantId: ctx.tenantId,
            displayId,
            circuitId: input.circuitId ?? null,
            circuitSequence,
            effectiveDate: input.effectiveDate,
            endDate: input.endDate ?? null,
            reason: input.reason,
            // Pas de "planifié" : l'avenant est enregistré comme versions datées
            // qui coexistent. La bascule au jour J est résolue par date.
            status: "actif",
            appliedAt: new Date(),
            createdByUserId: ctx.user.id,
          })
          .returning();
        avenant = inserted[0]!;
      }

      // Insère les NOUVEAUX changements puis applique UNIQUEMENT ceux-ci
      // (en fusion, ne pas ré-appliquer les changements déjà présents).
      const newChanges: (typeof avenantChanges.$inferSelect)[] = [];
      for (const change of input.changes) {
        const previousValue = await capturePrevious(ctx, change);
        const newValue = await buildNewValue(ctx, change);
        const ins = await ctx.db
          .insert(avenantChanges)
          .values({
            tenantId: ctx.tenantId,
            avenantId: avenant.id,
            usagerId: change.usagerId,
            type: change.type,
            usagerCircuitId:
              "usagerCircuitId" in change ? change.usagerCircuitId : null,
            usagerAddressId:
              "usagerAddressId" in change
                ? (change.usagerAddressId ?? null)
                : null,
            previousValue,
            newValue,
          })
          .returning();
        if (ins[0]) newChanges.push(ins[0]);
      }

      // Application UNIFORME (passé/présent/futur) : versions datées coexistantes.
      for (const c of newChanges) await applyChange(ctx, c, input.effectiveDate);

      return avenant;
    }),

  cancel: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const header = await assertAvenantOwned(ctx, input.id);
      // Soft delete de l'avenant.
      await ctx.db
        .update(avenants)
        .set({ status: "annule", deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(avenants.id, input.id));
      // Annule le versioning de trajets que cet avenant avait produit : supprime
      // les trajets qu'il a créés et rouvre ceux qu'il avait clôturés (sinon des
      // trajets « fantômes » datés restent sur le circuit après suppression).
      if (header.circuitId) {
        await revertAvenantVersioning(
          ctx,
          header.circuitId,
          header.effectiveDate,
          input.id,
        );
      }
      return { ...header, status: "annule" };
    }),
});

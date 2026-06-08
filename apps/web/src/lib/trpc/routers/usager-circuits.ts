import { z } from "zod";
import { eq, and, or, lte, gte, isNull, sql, inArray } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  trajets,
  arrets,
  avenants,
  avenantChanges,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  usagerCircuitSchema,
  usagerCircuitUpdateSchema,
} from "@/lib/validators/usager-circuit";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { dateRangesOverlap } from "@/lib/utils/date-helpers";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import {
  syncTrajetForDirection,
  removeUsagerArretsFromCircuit,
  regenerateCircuitTrajets,
  type TrajetSyncCtx,
} from "../services/trajet-sync";
import { nextDisplayId } from "@/lib/db/display-id";
import {
  suggestCircuits,
  type CandidateCircuit,
  type SuggestionAddress,
} from "../services/circuit-suggestions";

/** Condition SQL : la version d'affectation active à la date donnée. */
function activeOnDate(dateStr: string) {
  return and(
    isNull(usagerCircuits.deletedAt),
    or(
      isNull(usagerCircuits.validFrom),
      lte(usagerCircuits.validFrom, dateStr),
    ),
    or(isNull(usagerCircuits.validTo), gte(usagerCircuits.validTo, dateStr)),
  );
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Avenant automatique « ajout d'usager » : tracé quand un usager rejoint un
 * circuit DÉJÀ DÉMARRÉ (sa date de début de transport est postérieure au début
 * du circuit). Fusionne dans l'avenant non annulé du même circuit à la même
 * date d'effet (comme avenants.create), sinon en crée un (numéroté par circuit).
 * Retourne l'id de l'avenant — passé aux trajets/arrêts pour la traçabilité.
 */
async function createAjoutAvenant(
  ctx: TrajetSyncCtx & { user: { id: string } },
  params: {
    circuitId: string;
    effectiveDate: string;
    usagerId: string;
    usagerCircuitId: string;
    usagerAddressId: string;
  },
): Promise<string> {
  const { circuitId, effectiveDate, usagerId, usagerCircuitId, usagerAddressId } =
    params;

  // Fusion : réutilise l'avenant du même circuit à la même date d'effet.
  const found = await ctx.db
    .select()
    .from(avenants)
    .where(
      and(
        eq(avenants.circuitId, circuitId),
        eq(avenants.effectiveDate, effectiveDate),
        eq(avenants.tenantId, ctx.tenantId),
        isNull(avenants.deletedAt),
      ),
    )
    .limit(1);
  let avenant = found[0] ?? null;

  if (!avenant) {
    const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "avenants");
    // N° d'avenant DANS le circuit (séquence propre au circuit).
    const seq = await ctx.db
      .select({
        max: sql<number>`coalesce(max(${avenants.circuitSequence}), 0)`,
      })
      .from(avenants)
      .where(
        and(
          eq(avenants.circuitId, circuitId),
          eq(avenants.tenantId, ctx.tenantId),
        ),
      );
    const circuitSequence = (seq[0]?.max ?? 0) + 1;
    const inserted = await ctx.db
      .insert(avenants)
      .values({
        tenantId: ctx.tenantId,
        displayId,
        circuitId,
        circuitSequence,
        effectiveDate,
        reason: "Ajout au circuit",
        // Versions datées coexistantes, bascule résolue par date (zéro trigger).
        status: "actif",
        appliedAt: new Date(),
        createdByUserId: ctx.user.id,
      })
      .returning();
    avenant = inserted[0]!;
  }

  // Snapshot « après » : l'usager est désormais sur ce circuit / cette adresse.
  // Pas de « avant » (previousValue null) : il n'était pas sur le circuit.
  const circuitRow = await ctx.db
    .select({ name: circuits.name })
    .from(circuits)
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
    .limit(1);

  await ctx.db.insert(avenantChanges).values({
    tenantId: ctx.tenantId,
    avenantId: avenant.id,
    usagerId,
    type: "ajout",
    usagerCircuitId,
    usagerAddressId,
    previousValue: null,
    newValue: {
      circuitId,
      circuitName: circuitRow[0]?.name ?? null,
      usagerAddressId,
    },
  });

  return avenant.id;
}

export const usagerCircuitsRouter = createTRPCRouter({
  listByUsager: tenantProcedure
    .input(z.object({ usagerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: usagerCircuits.id,
          usagerId: usagerCircuits.usagerId,
          circuitId: usagerCircuits.circuitId,
          usagerAddressId: usagerCircuits.usagerAddressId,
          // Début de cette version d'affectation (null = depuis toujours :
          // l'usager démarre alors à sa date de début de transport).
          validFrom: usagerCircuits.validFrom,
          arrivalNotification: usagerCircuits.arrivalNotification,
          authorizationAlone: usagerCircuits.authorizationAlone,
          circuitName: circuits.name,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          addressType: usagerAddresses.type,
          addressCity: usagerAddresses.city,
          addressAddress: usagerAddresses.address,
          // Jours lus depuis la VERSION d'affectation (résolue par date),
          // pas depuis l'adresse — la version est la source de vérité.
          daysAller: usagerCircuits.daysAller,
          daysRetour: usagerCircuits.daysRetour,
        })
        .from(usagerCircuits)
        .innerJoin(circuits, eq(usagerCircuits.circuitId, circuits.id))
        .leftJoin(
          etablissements,
          eq(circuits.etablissementId, etablissements.id),
        )
        .leftJoin(
          usagerAddresses,
          eq(usagerCircuits.usagerAddressId, usagerAddresses.id),
        )
        .where(
          and(
            eq(usagerCircuits.usagerId, input.usagerId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            // Versions OUVERTES (en cours ou à venir) — cohérent avec la garde
            // « un circuit actif par adresse » et l'index unique partiel.
            // Une affectation future (valid_from > aujourd'hui) occupe déjà
            // l'adresse : elle doit donc apparaître ici.
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        );

      return rows.map((row) => ({
        ...row,
        daysAller: normalizeDays(row.daysAller),
        daysRetour: normalizeDays(row.daysRetour),
      }));
    }),

  listByCircuit: tenantProcedure
    .input(
      z.object({
        circuitId: z.string().uuid(),
        // Date de résolution (défaut : aujourd'hui). Une date d'avenant donne la
        // composition usagers/PEC du circuit telle qu'à cette date.
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        // true = toutes les affectations OUVERTES (courantes + à venir), pour la
        // liste des usagers du circuit (un usager futur doit y figurer). Défaut
        // (false) = composition active à la date (recap).
        openOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: usagerCircuits.id,
          usagerId: usagerCircuits.usagerId,
          circuitId: usagerCircuits.circuitId,
          usagerAddressId: usagerCircuits.usagerAddressId,
          validFrom: usagerCircuits.validFrom,
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
          usagerCode: usagers.code,
          transportStartDate: usagers.transportStartDate,
          addressType: usagerAddresses.type,
          addressCity: usagerAddresses.city,
          addressAddress: usagerAddresses.address,
          addressCivility: usagerAddresses.civility,
          responsibleFirstName: usagerAddresses.responsibleFirstName,
          responsibleLastName: usagerAddresses.responsibleLastName,
          addressPhone: usagerAddresses.phone,
          addressMobile: usagerAddresses.mobile,
          arrivalNotification: usagerCircuits.arrivalNotification,
          authorizationAlone: usagerCircuits.authorizationAlone,
          daysAller: usagerCircuits.daysAller,
          daysRetour: usagerCircuits.daysRetour,
          avenantCount: sql<number>`(select count(*) from ${avenantChanges} ac join ${avenants} a on a.id = ac.avenant_id where ac.usager_id = ${usagerCircuits.usagerId} and a.circuit_id = ${usagerCircuits.circuitId} and a.deleted_at is null)::int`,
        })
        .from(usagerCircuits)
        .innerJoin(usagers, eq(usagerCircuits.usagerId, usagers.id))
        .leftJoin(
          usagerAddresses,
          eq(usagerCircuits.usagerAddressId, usagerAddresses.id),
        )
        .where(
          and(
            eq(usagerCircuits.circuitId, input.circuitId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            // openOnly : toutes les versions ouvertes (courantes + futures) ;
            // sinon composition active à la date (défaut : aujourd'hui).
            input.openOnly
              ? and(
                  isNull(usagerCircuits.validTo),
                  isNull(usagerCircuits.deletedAt),
                )
              : activeOnDate(input.date ?? todayStr()),
          ),
        );

      return rows.map((row) => ({
        ...row,
        daysAller: normalizeDays(row.daysAller),
        daysRetour: normalizeDays(row.daysRetour),
      }));
    }),

  countByCircuit: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.circuitId, input.circuitId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            activeOnDate(todayStr()),
          ),
        );
      return result[0]?.count ?? 0;
    }),

  /**
   * Suggère les circuits les plus pertinents pour un usager, avec le détail
   * des raisons (même établissement, tracé proche du domicile, arrêt
   * mutualisable). Le calcul de proximité se fait en JS (pas de PostGIS).
   */
  suggestForUsager: tenantProcedure
    .input(z.object({ usagerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const today = todayStr();

      // 1. Usager : établissements de destination + type de transport.
      const [usager] = await ctx.db
        .select({
          etablissementId: usagers.etablissementId,
          secondaryEtablissementId: usagers.secondaryEtablissementId,
          transportType: usagers.transportType,
        })
        .from(usagers)
        .where(
          and(
            eq(usagers.id, input.usagerId),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .limit(1);
      if (!usager) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usager non trouvé" });
      }
      // Transport sans circuit → aucune suggestion.
      if (!isCircuitCompatibleTransport(usager.transportType)) {
        return [];
      }

      // 2. Adresses géocodées de l'usager.
      const addrRows = await ctx.db
        .select({
          type: usagerAddresses.type,
          position: usagerAddresses.position,
          latitude: usagerAddresses.latitude,
          longitude: usagerAddresses.longitude,
        })
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.usagerId, input.usagerId),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        );
      const addresses: SuggestionAddress[] = addrRows
        .filter(
          (a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude),
        )
        .map((a) => ({
          lat: a.latitude as number,
          lng: a.longitude as number,
          label:
            (a.type &&
              ADDRESS_TYPE_LABELS[
                a.type as keyof typeof ADDRESS_TYPE_LABELS
              ]) ||
            `Adresse ${a.position}`,
        }));

      // 3. Circuits candidats : actifs, non supprimés, non déjà liés.
      const linkedRows = await ctx.db
        .select({ circuitId: usagerCircuits.circuitId })
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.usagerId, input.usagerId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            activeOnDate(today),
          ),
        );
      const linkedSet = new Set(linkedRows.map((r) => r.circuitId));

      const circuitRows = await ctx.db
        .select({ id: circuits.id, etablissementId: circuits.etablissementId })
        .from(circuits)
        .where(
          and(
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
            isNull(circuits.archivedAt),
          ),
        );
      const candidates = circuitRows.filter((c) => !linkedSet.has(c.id));
      if (candidates.length === 0) return [];
      const candidateIds = candidates.map((c) => c.id);

      // 4. Tracés (routeGeometry) des trajets de ces circuits.
      const trajetRows = await ctx.db
        .select({
          circuitId: trajets.circuitId,
          routeGeometry: trajets.routeGeometry,
        })
        .from(trajets)
        .where(
          and(
            inArray(trajets.circuitId, candidateIds),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        );

      // 5. Arrêts usager (avec coordonnées, valides aujourd'hui).
      const stopRows =
        addresses.length > 0
          ? await ctx.db
              .select({
                circuitId: trajets.circuitId,
                latitude: arrets.latitude,
                longitude: arrets.longitude,
              })
              .from(arrets)
              .innerJoin(trajets, eq(arrets.trajetId, trajets.id))
              .where(
                and(
                  inArray(trajets.circuitId, candidateIds),
                  eq(arrets.tenantId, ctx.tenantId),
                  isNull(arrets.deletedAt),
                  eq(arrets.type, "usager"),
                  or(isNull(arrets.validFrom), lte(arrets.validFrom, today)),
                  or(isNull(arrets.validTo), gte(arrets.validTo, today)),
                ),
              )
          : [];

      // 6. Regroupe tracés et arrêts par circuit.
      const routesByCircuit = new Map<string, number[][][]>();
      for (const t of trajetRows) {
        const geom = t.routeGeometry;
        if (
          !t.circuitId ||
          !geom ||
          !Array.isArray(geom.coordinates) ||
          geom.coordinates.length < 2
        ) {
          continue;
        }
        const list = routesByCircuit.get(t.circuitId) ?? [];
        list.push(geom.coordinates);
        routesByCircuit.set(t.circuitId, list);
      }
      const stopsByCircuit = new Map<string, { lat: number; lng: number }[]>();
      for (const s of stopRows) {
        // `== null` narrows à number (NaN exclu par Number.isFinite).
        if (
          s.latitude == null ||
          s.longitude == null ||
          !Number.isFinite(s.latitude) ||
          !Number.isFinite(s.longitude) ||
          !s.circuitId
        ) {
          continue;
        }
        const list = stopsByCircuit.get(s.circuitId) ?? [];
        list.push({ lat: s.latitude, lng: s.longitude });
        stopsByCircuit.set(s.circuitId, list);
      }

      const candidateCircuits: CandidateCircuit[] = candidates.map((c) => ({
        id: c.id,
        etablissementId: c.etablissementId,
        routes: routesByCircuit.get(c.id) ?? [],
        stops: stopsByCircuit.get(c.id) ?? [],
      }));

      return suggestCircuits(
        {
          etablissementId: usager.etablissementId,
          secondaryEtablissementId: usager.secondaryEtablissementId,
          addresses,
        },
        candidateCircuits,
      );
    }),

  create: tenantProcedure
    .input(usagerCircuitSchema)
    .mutation(async ({ ctx, input }) => {
      // Garde-fou métier : seul un usager en transport "circuit" (taxi collectif /
      // individuel) peut être affecté à un circuit. Famille et transport en commun
      // relèvent du remboursement. La règle est aussi appliquée côté UI, mais on la
      // (re)valide ici pour ne pas créer de données incohérentes via un appel direct.
      const [targetUsager] = await ctx.db
        .select({
          transportType: usagers.transportType,
          transportStartDate: usagers.transportStartDate,
          transportEndDate: usagers.transportEndDate,
          preparationCampaignId: usagers.preparationCampaignId,
        })
        .from(usagers)
        .where(
          and(
            eq(usagers.id, input.usagerId),
            eq(usagers.tenantId, ctx.tenantId),
            isNull(usagers.deletedAt),
          ),
        )
        .limit(1);
      if (!targetUsager) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usager non trouvé" });
      }
      if (!isCircuitCompatibleTransport(targetUsager.transportType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le type de transport de cet usager ne permet pas d'affectation à un circuit.",
        });
      }

      // Cohérence des dates : la période de transport de l'usager doit chevaucher
      // la période de validité du circuit. Un circuit terminé avant le début de
      // transport (ou commençant après sa fin) ne peut pas lui être affecté.
      const [targetCircuit] = await ctx.db
        .select({
          startDate: circuits.startDate,
          endDate: circuits.endDate,
          preparationCampaignId: circuits.preparationCampaignId,
        })
        .from(circuits)
        .where(
          and(
            eq(circuits.id, input.circuitId),
            eq(circuits.tenantId, ctx.tenantId),
            isNull(circuits.deletedAt),
          ),
        )
        .limit(1);
      if (!targetCircuit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Circuit non trouvé" });
      }
      if (
        !dateRangesOverlap(
          targetUsager.transportStartDate,
          targetUsager.transportEndDate,
          targetCircuit.startDate,
          targetCircuit.endDate,
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Les dates de transport de l'usager ne chevauchent pas la période de validité du circuit.",
        });
      }

      // Cohérence : un seul circuit ACTIF par (usager, adresse). On n'empile pas
      // un 2e circuit sur la même adresse — un changement passe par un avenant.
      // L'association initiale d'une adresse LIBRE reste directe.
      const existingOnAddress = await ctx.db
        .select({ id: usagerCircuits.id })
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.usagerId, input.usagerId),
            eq(usagerCircuits.usagerAddressId, input.usagerAddressId),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        )
        .limit(1);
      if (existingOnAddress.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cette adresse a déjà un circuit actif. Modifiez-le via un avenant.",
        });
      }

      // Read days from the address
      const addr = await ctx.db
        .select({ daysAller: usagerAddresses.daysAller, daysRetour: usagerAddresses.daysRetour })
        .from(usagerAddresses)
        .where(
          and(
            eq(usagerAddresses.id, input.usagerAddressId),
            eq(usagerAddresses.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);
      const addrDaysAller = normalizeDays(addr[0]?.daysAller);
      const addrDaysRetour = normalizeDays(addr[0]?.daysRetour);

      // L'usager rejoint-il un circuit DÉJÀ DÉMARRÉ ? (sa date de début de
      // transport est postérieure au début du circuit). Si oui : on borne son
      // affectation à sa date de début (valid_from) — il n'apparaît pas avant —
      // ET on trace l'ajout par un avenant automatique. Sinon : intégration
      // initiale directe (valid_from null = présent dès le début du circuit).
      // Exclu en préparation de rentrée : pas d'avenant dans une campagne (le
      // sandbox se construit à plat, sans historique de changements).
      const isPreparation =
        !!targetUsager.preparationCampaignId ||
        !!targetCircuit.preparationCampaignId;
      const circuitStart = targetCircuit.startDate;
      const usagerStart = targetUsager.transportStartDate;
      const joinsRunningCircuit =
        !isPreparation &&
        !!circuitStart &&
        !!usagerStart &&
        usagerStart > circuitStart;
      const validFrom = joinsRunningCircuit ? usagerStart : null;

      const result = await ctx.db
        .insert(usagerCircuits)
        .values({
          tenantId: ctx.tenantId,
          usagerId: input.usagerId,
          circuitId: input.circuitId,
          usagerAddressId: input.usagerAddressId,
          daysAller: addrDaysAller.length > 0 ? addrDaysAller : null,
          daysRetour: addrDaysRetour.length > 0 ? addrDaysRetour : null,
          arrivalNotification: input.arrivalNotification ?? false,
          authorizationAlone: input.authorizationAlone ?? false,
          validFrom,
        })
        .returning();

      const created = result[0];

      // Avenant automatique « ajout d'usager » (uniquement si circuit démarré).
      let avenantId: string | null = null;
      if (created && joinsRunningCircuit && usagerStart) {
        avenantId = await createAjoutAvenant(ctx, {
          circuitId: input.circuitId,
          effectiveDate: usagerStart,
          usagerId: input.usagerId,
          usagerCircuitId: created.id,
          usagerAddressId: input.usagerAddressId,
        });
      }

      if (created) {
        if (joinsRunningCircuit && avenantId && usagerStart) {
          // Rejoint un circuit DÉJÀ DÉMARRÉ → on VERSIONNE les trajets : l'avenant
          // d'ajout crée de nouveaux trajets datés (nouvelle composition depuis J),
          // l'ancien est clôturé à J-1. L'affectation du nouvel usager vient d'être
          // posée → regenerate lit la composition complète à la date d'effet.
          await regenerateCircuitTrajets(
            ctx,
            input.circuitId,
            usagerStart,
            avenantId,
          );
        } else {
          // Intégration initiale (base, « avenant 0 ») : trajets non versionnés.
          if (addrDaysAller.length > 0) {
            await syncTrajetForDirection(
              ctx,
              input.circuitId,
              "aller",
              addrDaysAller,
              input.usagerAddressId,
              validFrom,
              avenantId,
            );
          }
          if (addrDaysRetour.length > 0) {
            await syncTrajetForDirection(
              ctx,
              input.circuitId,
              "retour",
              addrDaysRetour,
              input.usagerAddressId,
              validFrom,
              avenantId,
            );
          }
        }
      }

      return created;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: usagerCircuitUpdateSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch existing record to know old address
      const existing = await ctx.db
        .select()
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.id, input.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      const old = existing[0];
      if (!old) return null;

      const newAddressId = input.data.usagerAddressId ?? old.usagerAddressId;

      // Read days from the (new) address
      let addrDaysAller: DayEntry[] = [];
      let addrDaysRetour: DayEntry[] = [];
      if (newAddressId) {
        const addr = await ctx.db
          .select({ daysAller: usagerAddresses.daysAller, daysRetour: usagerAddresses.daysRetour })
          .from(usagerAddresses)
          .where(
            and(
              eq(usagerAddresses.id, newAddressId),
              eq(usagerAddresses.tenantId, ctx.tenantId),
            ),
          )
          .limit(1);
        addrDaysAller = normalizeDays(addr[0]?.daysAller);
        addrDaysRetour = normalizeDays(addr[0]?.daysRetour);
      }

      const result = await ctx.db
        .update(usagerCircuits)
        .set({
          usagerAddressId: newAddressId,
          daysAller: addrDaysAller.length > 0 ? addrDaysAller : null,
          daysRetour: addrDaysRetour.length > 0 ? addrDaysRetour : null,
          arrivalNotification: input.data.arrivalNotification ?? old.arrivalNotification,
          authorizationAlone: input.data.authorizationAlone ?? old.authorizationAlone,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usagerCircuits.id, input.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      // Remove old arrets then re-sync
      if (old.usagerAddressId) {
        await removeUsagerArretsFromCircuit(ctx, old.circuitId, old.usagerAddressId);
      }

      if (newAddressId) {
        if (addrDaysAller.length > 0) {
          await syncTrajetForDirection(
            ctx,
            old.circuitId,
            "aller",
            addrDaysAller,
            newAddressId,
          );
        }
        if (addrDaysRetour.length > 0) {
          await syncTrajetForDirection(
            ctx,
            old.circuitId,
            "retour",
            addrDaysRetour,
            newAddressId,
          );
        }
      }

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch existing to clean up arrets
      const existing = await ctx.db
        .select()
        .from(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.id, input.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      const old = existing[0];

      // Garde : dès qu'un circuit a un avenant (au-delà de la composition de base
      // « avenant 0 »), sa composition est versionnée → on n'enlève plus aucun
      // usager directement (cela corromprait l'historique daté des trajets). Il
      // faut d'abord annuler les avenants (un retrait passera à terme par un
      // avenant dédié).
      if (old) {
        const circuitAvenants = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(avenants)
          .where(
            and(
              eq(avenants.circuitId, old.circuitId),
              eq(avenants.tenantId, ctx.tenantId),
              isNull(avenants.deletedAt),
            ),
          );
        if ((circuitAvenants[0]?.count ?? 0) > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Impossible de dissocier : ce circuit a des avenants. Annulez-les d'abord pour modifier sa composition.",
          });
        }
      }

      // Remove arrets before deleting the association
      if (old?.usagerAddressId) {
        await removeUsagerArretsFromCircuit(ctx, old.circuitId, old.usagerAddressId);
      }

      // Soft-delete (cohérent avec le modèle daté : on conserve l'historique ;
      // l'index partiel "1 circuit actif/adresse" se libère via deleted_at).
      const result = await ctx.db
        .update(usagerCircuits)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(usagerCircuits.id, input.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
            isNull(usagerCircuits.deletedAt),
          ),
        )
        .returning();

      // Note : l'archivage d'un circuit est désormais MANUEL (plus de bascule
      // automatique « inactif » quand le dernier usager est dissocié).

      return result[0] ?? null;
    }),
});

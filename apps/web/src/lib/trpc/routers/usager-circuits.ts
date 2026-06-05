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
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  usagerCircuitSchema,
  usagerCircuitUpdateSchema,
} from "@/lib/validators/usager-circuit";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import {
  syncTrajetForDirection,
  removeUsagerArretsFromCircuit,
} from "../services/trajet-sync";
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
            activeOnDate(todayStr()),
          ),
        );

      return rows.map((row) => ({
        ...row,
        daysAller: normalizeDays(row.daysAller),
        daysRetour: normalizeDays(row.daysRetour),
      }));
    }),

  listByCircuit: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: usagerCircuits.id,
          usagerId: usagerCircuits.usagerId,
          circuitId: usagerCircuits.circuitId,
          usagerAddressId: usagerCircuits.usagerAddressId,
          usagerFirstName: usagers.firstName,
          usagerLastName: usagers.lastName,
          usagerCode: usagers.code,
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
            activeOnDate(todayStr()),
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
            eq(circuits.isActive, true),
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
        .select({ transportType: usagers.transportType })
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
        .where(eq(usagerAddresses.id, input.usagerAddressId))
        .limit(1);
      const addrDaysAller = normalizeDays(addr[0]?.daysAller);
      const addrDaysRetour = normalizeDays(addr[0]?.daysRetour);

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
        })
        .returning();

      const created = result[0];

      // Auto-create trajets + arrets
      if (created) {
        if (addrDaysAller.length > 0) {
          await syncTrajetForDirection(
            ctx,
            input.circuitId,
            "aller",
            addrDaysAller,
            input.usagerAddressId,
          );
        }
        if (addrDaysRetour.length > 0) {
          await syncTrajetForDirection(
            ctx,
            input.circuitId,
            "retour",
            addrDaysRetour,
            input.usagerAddressId,
          );
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
          .where(eq(usagerAddresses.id, newAddressId))
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

      // Remove arrets before deleting the association
      if (old?.usagerAddressId) {
        await removeUsagerArretsFromCircuit(ctx, old.circuitId, old.usagerAddressId);
      }

      const result = await ctx.db
        .delete(usagerCircuits)
        .where(
          and(
            eq(usagerCircuits.id, input.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      // If no more usagers on this circuit, set it inactive
      if (old) {
        const remaining = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(usagerCircuits)
          .where(
            and(
              eq(usagerCircuits.circuitId, old.circuitId),
              eq(usagerCircuits.tenantId, ctx.tenantId),
            ),
          );

        if ((remaining[0]?.count ?? 0) === 0) {
          await ctx.db
            .update(circuits)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(circuits.id, old.circuitId));
        }
      }

      return result[0] ?? null;
    }),
});

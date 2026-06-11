import { z } from "zod";
import { eq, and, or, lte, gte, isNull, inArray } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  usagers,
  usagerAddresses,
  trajets,
  arrets,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../../init";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import {
  suggestCircuits,
  type CandidateCircuit,
  type SuggestionAddress,
} from "../../services/circuit-suggestions";
import { activeOnDate, todayStr } from "./shared";

/**
 * Suggests the most relevant circuits for a usager, with the detail of the
 * reasons (same etablissement, route close to home, shareable stop).
 * The proximity computation is done in JS (no PostGIS).
 */
export const suggestForUsager = tenantProcedure
  .input(z.object({ usagerId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const today = todayStr();

    // 1. Usager: destination etablissements + transport type.
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
    // Transport without circuit → no suggestions.
    if (!isCircuitCompatibleTransport(usager.transportType)) {
      return [];
    }

    // 2. The usager's geocoded addresses.
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

    // 3. Candidate circuits: active, not deleted, not already linked.
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

    // 4. Routes (routeGeometry) of these circuits' trajets.
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

    // 5. Usager stops (with coordinates, valid today).
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

    // 6. Group routes and stops by circuit.
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
      // `== null` narrows to number (NaN excluded by Number.isFinite).
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
  });

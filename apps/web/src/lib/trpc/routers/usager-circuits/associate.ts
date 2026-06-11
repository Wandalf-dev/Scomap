import { eq, and, isNull, sql } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  usagers,
  usagerAddresses,
  avenants,
  avenantChanges,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../../init";
import { usagerCircuitSchema } from "@/lib/validators/usager-circuit";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { dateRangesOverlap } from "@/lib/utils/date-helpers";
import { normalizeDays } from "@/lib/types/day-entry";
import {
  syncTrajetForDirection,
  regenerateCircuitTrajets,
  type TrajetSyncCtx,
} from "../../services/trajet-sync";
import { nextDisplayId } from "@/lib/db/display-id";

/**
 * Automatic "usager addition" avenant: recorded when a usager joins a circuit
 * that has ALREADY STARTED (their transport start date is after the circuit's
 * start). Merges into the non-cancelled avenant of the same circuit with the
 * same effective date (like avenants.create), otherwise creates one (numbered
 * per circuit). Returns the avenant id — passed to trajets/arrets for
 * traceability.
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

  // Merge: reuse the avenant of the same circuit with the same effective date.
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
    // Avenant number WITHIN the circuit (sequence specific to the circuit).
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
        // Coexisting dated versions, switchover resolved by date (zero triggers).
        status: "actif",
        appliedAt: new Date(),
        createdByUserId: ctx.user.id,
      })
      .returning();
    avenant = inserted[0]!;
  }

  // "After" snapshot: the usager is now on this circuit / this address.
  // No "before" (previousValue null): they were not on the circuit.
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

export const create = tenantProcedure
  .input(usagerCircuitSchema)
  .mutation(async ({ ctx, input }) => {
    // Business safeguard: only a usager with "circuit" transport (shared /
    // individual taxi) can be assigned to a circuit. Family and public transport
    // fall under reimbursement. The rule is also enforced UI-side, but we
    // (re)validate it here to avoid creating inconsistent data via a direct call.
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

    // Date consistency: the usager's transport period must overlap the circuit's
    // validity period. A circuit that ended before the transport start (or
    // starting after its end) cannot be assigned to them.
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

    // Consistency: a single ACTIVE circuit per (usager, address). We don't stack
    // a 2nd circuit on the same address — a change goes through an avenant.
    // The initial association of a FREE address remains direct.
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

    // Read days from the address — which must belong to THIS usager, otherwise
    // we would assign the circuit through another usager's address
    const addr = await ctx.db
      .select({ daysAller: usagerAddresses.daysAller, daysRetour: usagerAddresses.daysRetour })
      .from(usagerAddresses)
      .where(
        and(
          eq(usagerAddresses.id, input.usagerAddressId),
          eq(usagerAddresses.usagerId, input.usagerId),
          eq(usagerAddresses.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);
    if (!addr[0]) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "L'adresse sélectionnée n'appartient pas à cet usager.",
      });
    }
    const addrDaysAller = normalizeDays(addr[0]?.daysAller);
    const addrDaysRetour = normalizeDays(addr[0]?.daysRetour);

    // Is the usager joining a circuit that has ALREADY STARTED? (their transport
    // start date is after the circuit's start). If so: we bound their assignment
    // to their start date (valid_from) — they don't appear before it — AND we
    // record the addition via an automatic avenant. Otherwise: direct initial
    // integration (valid_from null = present from the circuit's start).
    // Excluded during back-to-school preparation: no avenant within a campaign
    // (the sandbox is built flat, without change history).
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

    // Automatic "usager addition" avenant (only if the circuit has started).
    let avenantId: string | null = null;
    if (created && joinsRunningCircuit && usagerStart) {
      avenantId = await createAjoutAvenant(ctx, {
        circuitId: input.circuitId,
        effectiveDate: usagerStart,
        usagerId: input.usagerId,
        usagerCircuitId: created.id,
        usagerAddressId: input.usagerAddressId,
      });
      // Mark the assignment as created by this addition avenant: cancelling it
      // will be able to soft-delete it (the usager should never have joined the
      // circuit).
      await ctx.db
        .update(usagerCircuits)
        .set({ createdByAvenantId: avenantId })
        .where(
          and(
            eq(usagerCircuits.id, created.id),
            eq(usagerCircuits.tenantId, ctx.tenantId),
          ),
        );
    }

    if (created) {
      if (joinsRunningCircuit && avenantId && usagerStart) {
        // Joining a circuit that has ALREADY STARTED → we VERSION the trajets:
        // the addition avenant creates new dated trajets (new composition from
        // day D), the old one is closed at D-1. The new usager's assignment has
        // just been put in place → regenerate reads the full composition at the
        // effective date.
        await regenerateCircuitTrajets(
          ctx,
          input.circuitId,
          usagerStart,
          avenantId,
        );
      } else {
        // Initial integration (base, "avenant 0"): non-versioned trajets.
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
  });

import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { usagerCircuits, avenants } from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../../init";
import { removeUsagerArretsFromCircuit } from "../../services/trajet-sync";

export const deleteUsagerCircuit = tenantProcedure
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

    // Guard: as soon as a circuit has an avenant (beyond the base composition,
    // "avenant 0"), its composition is versioned → we no longer remove any
    // usager directly (that would corrupt the trajets' dated history). The
    // avenants must be cancelled first (a removal will eventually go through a
    // dedicated avenant).
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

    // Soft-delete (consistent with the dated model: we keep the history;
    // the "1 active circuit/address" partial index is freed via deleted_at).
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

    // Note: archiving a circuit is now MANUAL (no more automatic "inactive"
    // switch when the last usager is dissociated).

    return result[0] ?? null;
  });

// Deletes a circuit's "initial composition" (synthetic "avenant 0") =
// dissociates ALL its usagers at once. Since avenant 0 is the base the dated
// avenants rely on, it can only be removed if NO real avenant exists yet
// (otherwise the trajets' dated history would be corrupted): those avenants
// must be cancelled first.
export const clearComposition = tenantProcedure
  .input(z.object({ circuitId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const realAvenants = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(avenants)
      .where(
        and(
          eq(avenants.circuitId, input.circuitId),
          eq(avenants.tenantId, ctx.tenantId),
          isNull(avenants.deletedAt),
        ),
      );
    if ((realAvenants[0]?.count ?? 0) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Impossible de supprimer la composition initiale : annulez d'abord les autres avenants du circuit.",
      });
    }

    // The circuit's OPEN assignments (= its current composition). We do NOT
    // touch closed versions (non-null validTo): they are the dated history
    // (e.g. back-to-school promotion closures) to preserve. Consistent with
    // usagerCount (which only counts validTo IS NULL).
    const assignments = await ctx.db
      .select()
      .from(usagerCircuits)
      .where(
        and(
          eq(usagerCircuits.circuitId, input.circuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          isNull(usagerCircuits.validTo),
          isNull(usagerCircuits.deletedAt),
        ),
      );

    // Remove each usager's stops, then soft-delete the assignments.
    for (const uc of assignments) {
      if (uc.usagerAddressId) {
        await removeUsagerArretsFromCircuit(
          ctx,
          uc.circuitId,
          uc.usagerAddressId,
        );
      }
    }
    await ctx.db
      .update(usagerCircuits)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(usagerCircuits.circuitId, input.circuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          isNull(usagerCircuits.validTo),
          isNull(usagerCircuits.deletedAt),
        ),
      );

    return { dissociated: assignments.length };
  });

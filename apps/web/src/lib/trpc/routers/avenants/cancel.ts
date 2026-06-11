import { z } from "zod";
import { eq } from "drizzle-orm";
import { avenants } from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import {
  revertAvenantVersioning,
  revertAvenantAssignments,
} from "../../services/trajet-sync";
import { assertAvenantOwned } from "./helpers";

export const cancel = tenantProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const header = await assertAvenantOwned(ctx, input.id);
    // Soft delete the avenant.
    await ctx.db
      .update(avenants)
      .set({ status: "annule", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(avenants.id, input.id));
    // Revert the DATED trajet versioning this avenant had produced
    // (regenerateCircuitTrajets: "addition" case on a started circuit): delete
    // the created trajets and reopen the ones closed at D-1.
    if (header.circuitId) {
      await revertAvenantVersioning(
        ctx,
        header.circuitId,
        header.effectiveDate,
        input.id,
      );
    }
    // Restore the ASSIGNMENTS (usager_circuits), their arrêts and the modified
    // usager attributes (transport type, etablissement) — otherwise the usager
    // stays on the new version, the old one stays closed, and usagerCount /
    // « Composition initiale » get skewed. Independent of the header circuit
    // (a type_transport / etablissement avenant may not have one).
    await revertAvenantAssignments(ctx, input.id, header.effectiveDate);
    return { ...header, status: "annule" };
  });

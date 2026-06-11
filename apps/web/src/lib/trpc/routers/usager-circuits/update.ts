import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { usagerCircuits, usagerAddresses } from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../../init";
import { usagerCircuitUpdateSchema } from "@/lib/validators/usager-circuit";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import {
  syncTrajetForDirection,
  removeUsagerArretsFromCircuit,
} from "../../services/trajet-sync";

export const update = tenantProcedure
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
            // The address must belong to the assignment's usager
            eq(usagerAddresses.usagerId, old.usagerId),
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
  });

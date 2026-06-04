import { z } from "zod";
import { eq, and, or, lte, gte, isNull, sql } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  usagerCircuitSchema,
  usagerCircuitUpdateSchema,
} from "@/lib/validators/usager-circuit";
import { isCircuitCompatibleTransport } from "@/lib/validators/usager";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import {
  syncTrajetForDirection,
  removeUsagerArretsFromCircuit,
} from "../services/trajet-sync";

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

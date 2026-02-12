import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  trajets,
  arrets,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  usagerCircuitSchema,
  usagerCircuitUpdateSchema,
} from "@/lib/validators/usager-circuit";
import {
  normalizeDays,
  areDayEntriesEqual,
  formatDaysShort,
  type DayEntry,
} from "@/lib/types/day-entry";

function buildTrajetName(direction: string, days: DayEntry[]): string {
  const label = direction === "aller" ? "Aller" : "Retour";
  return `${label} ${formatDaysShort(days)}`;
}

type Ctx = {
  db: typeof import("@scomap/db").db;
  tenantId: string;
};

async function autoCreateEtablissementArret(
  ctx: Ctx,
  trajetId: string,
  circuitId: string,
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
    .where(eq(circuits.id, circuitId))
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
  });
}

async function addUsagerArret(
  ctx: Ctx,
  trajetId: string,
  usagerAddressId: string,
) {
  // Check if this usager arret already exists on this trajet
  const existing = await ctx.db
    .select({ id: arrets.id })
    .from(arrets)
    .where(
      and(
        eq(arrets.trajetId, trajetId),
        eq(arrets.usagerAddressId, usagerAddressId),
        isNull(arrets.deletedAt),
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
      label: usagerAddresses.label,
      usagerFirstName: usagers.firstName,
      usagerLastName: usagers.lastName,
    })
    .from(usagerAddresses)
    .innerJoin(usagers, eq(usagerAddresses.usagerId, usagers.id))
    .where(eq(usagerAddresses.id, usagerAddressId))
    .limit(1);

  const a = addr[0];
  if (!a) return;

  // Get max orderIndex on this trajet
  const maxResult = await ctx.db
    .select({ maxIdx: sql<number>`coalesce(max(${arrets.orderIndex}), 0)` })
    .from(arrets)
    .where(
      and(eq(arrets.trajetId, trajetId), isNull(arrets.deletedAt)),
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
  });
}

async function syncTrajetForDirection(
  ctx: Ctx,
  circuitId: string,
  direction: string,
  days: DayEntry[],
  usagerAddressId: string,
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
    await addUsagerArret(ctx, matchingTrajet.id, usagerAddressId);
  } else {
    // Create new trajet
    const sortedDays = [...days].sort((a, b) => a.day - b.day);
    const name = buildTrajetName(direction, sortedDays);
    const result = await ctx.db
      .insert(trajets)
      .values({
        tenantId: ctx.tenantId,
        circuitId,
        name,
        direction,
        recurrence: { frequency: "weekly" as const, daysOfWeek: sortedDays },
      })
      .returning();

    const created = result[0];
    if (created) {
      await autoCreateEtablissementArret(ctx, created.id, circuitId);
      await addUsagerArret(ctx, created.id, usagerAddressId);
    }
  }
}

async function removeUsagerArretsFromCircuit(
  ctx: Ctx,
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

  for (const trajet of circuitTrajets) {
    // Soft-delete arrets with this usagerAddressId
    await ctx.db
      .update(arrets)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(arrets.trajetId, trajet.id),
          eq(arrets.usagerAddressId, usagerAddressId),
          isNull(arrets.deletedAt),
        ),
      );

    // Check if trajet still has usager arrets
    const remaining = await ctx.db
      .select({ id: arrets.id })
      .from(arrets)
      .where(
        and(
          eq(arrets.trajetId, trajet.id),
          eq(arrets.type, "usager"),
          isNull(arrets.deletedAt),
        ),
      )
      .limit(1);

    // If no usager arrets left, soft-delete the trajet
    if (remaining.length === 0) {
      await ctx.db
        .update(trajets)
        .set({ deletedAt: new Date() })
        .where(eq(trajets.id, trajet.id));
    }
  }
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
          circuitName: circuits.name,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          addressLabel: usagerAddresses.label,
          addressCity: usagerAddresses.city,
          addressAddress: usagerAddresses.address,
          daysAller: usagerAddresses.daysAller,
          daysRetour: usagerAddresses.daysRetour,
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
          addressLabel: usagerAddresses.label,
          addressCity: usagerAddresses.city,
          addressAddress: usagerAddresses.address,
          daysAller: usagerAddresses.daysAller,
          daysRetour: usagerAddresses.daysRetour,
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
          ),
        );

      return rows.map((row) => ({
        ...row,
        daysAller: normalizeDays(row.daysAller),
        daysRetour: normalizeDays(row.daysRetour),
      }));
    }),

  create: tenantProcedure
    .input(usagerCircuitSchema)
    .mutation(async ({ ctx, input }) => {
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

      return result[0] ?? null;
    }),
});

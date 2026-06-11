import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  avenants,
  usagers,
  usagerAddresses,
  circuits,
  etablissements,
} from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import { avenantCreateSchema } from "@/lib/validators/avenant";
import {
  syncTrajetForDirection,
  type TrajetSyncCtx,
} from "../../services/trajet-sync";

export type Ctx = TrajetSyncCtx;

// ── Read helpers ────────────────────────────────────────────────────
export async function resolveEtabNames(
  ctx: Ctx,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const valid = ids.filter((id): id is string => !!id);
  const map = new Map<string, string>();
  if (valid.length === 0) return map;
  // Tenant filter + inArray: only reads the targeted etablissements of the
  // tenant (fixes a cross-tenant leak AND a full table scan).
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

export async function readAddress(ctx: Ctx, addressId: string) {
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

export async function readAddressDays(
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

export async function syncTrajets(
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

/** Previous day's date (YYYY-MM-DD string). */
export function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** ISO (YYYY-MM-DD) → DD/MM/YYYY for error messages. */
export function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Guard: the effective date must fall within the validity window of the
// circuit AND of every affected usager. Comparisons are lexicographic (the
// ISO YYYY-MM-DD format is chronologically ordered). A null bound = no
// constraint on that side. This is the HARD guard (the client only mirrors it).
export async function assertEffectiveDateWithinBounds(
  ctx: Ctx,
  input: z.infer<typeof avenantCreateSchema>,
): Promise<void> {
  const eff = input.effectiveDate;

  // Circuits to check: the header (current circuit of the assignment) + the
  // new circuit of a potential circuit change (the new assignment version
  // starts there at the effective date).
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

  // Usagers affected by the changes.
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

export async function assertAvenantOwned(ctx: Ctx, id: string) {
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

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  usagers,
  usagerCircuits,
  circuits,
  type AvenantSnapshot,
} from "@scomap/db/schema";
import { avenantCreateSchema } from "@/lib/validators/avenant";
import { USAGER_TRANSPORT_TYPE_LABELS } from "@/lib/validators/usager";
import {
  readAddress,
  readAddressDays,
  resolveEtabNames,
  type Ctx,
} from "./helpers";

// ── Snapshot capture (BEFORE state) ─────────────────────────────────
export async function capturePrevious(
  ctx: Ctx,
  change: {
    type: string;
    usagerId: string;
    usagerCircuitId?: string | null;
  },
): Promise<AvenantSnapshot | null> {
  if (change.type === "etablissement") {
    const rows = await ctx.db
      .select({
        etablissementId: usagers.etablissementId,
        secondaryEtablissementId: usagers.secondaryEtablissementId,
      })
      .from(usagers)
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      )
      .limit(1);
    const u = rows[0];
    if (!u) return null;
    const names = await resolveEtabNames(ctx, [
      u.etablissementId,
      u.secondaryEtablissementId,
    ]);
    return {
      etablissementId: u.etablissementId,
      etablissementName: names.get(u.etablissementId ?? "") ?? null,
      secondaryEtablissementId: u.secondaryEtablissementId,
      secondaryEtablissementName:
        names.get(u.secondaryEtablissementId ?? "") ?? null,
    };
  }

  if (change.type === "type_transport") {
    const rows = await ctx.db
      .select({ transportType: usagers.transportType })
      .from(usagers)
      .where(
        and(eq(usagers.id, change.usagerId), eq(usagers.tenantId, ctx.tenantId)),
      )
      .limit(1);
    const t = rows[0]?.transportType ?? null;
    return {
      transportType: t,
      transportTypeLabel: t
        ? USAGER_TRANSPORT_TYPE_LABELS[
            t as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
          ] ?? t
        : null,
    };
  }

  if (!change.usagerCircuitId) return null;
  const ucRows = await ctx.db
    .select({
      circuitId: usagerCircuits.circuitId,
      usagerAddressId: usagerCircuits.usagerAddressId,
      circuitName: circuits.name,
    })
    .from(usagerCircuits)
    .innerJoin(circuits, eq(usagerCircuits.circuitId, circuits.id))
    .where(
      and(
        eq(usagerCircuits.id, change.usagerCircuitId),
        eq(usagerCircuits.tenantId, ctx.tenantId),
      ),
    )
    .limit(1);
  const uc = ucRows[0];
  if (!uc) return null;

  if (change.type === "circuit") {
    return {
      circuitId: uc.circuitId,
      circuitName: uc.circuitName,
      usagerAddressId: uc.usagerAddressId,
    };
  }

  if (change.type === "jours_pec") {
    const days = await readAddressDays(ctx, uc.usagerAddressId);
    return {
      circuitId: uc.circuitId,
      daysAller: days.daysAller,
      daysRetour: days.daysRetour,
    };
  }

  // "adresse" change
  if (!uc.usagerAddressId) {
    return {
      usagerAddressId: "",
      address: null,
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
      type: null,
    };
  }
  const a = await readAddress(ctx, uc.usagerAddressId);
  return {
    usagerAddressId: uc.usagerAddressId,
    address: a?.address ?? null,
    city: a?.city ?? null,
    postalCode: a?.postalCode ?? null,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
    type: a?.type ?? null,
  };
}

// ── Building the AFTER snapshot from the input ──────────────────────
export async function buildNewValue(
  ctx: Ctx,
  change: z.infer<typeof avenantCreateSchema>["changes"][number],
): Promise<AvenantSnapshot> {
  if (change.type === "etablissement") {
    const names = await resolveEtabNames(ctx, [
      change.etablissementId,
      change.secondaryEtablissementId ?? null,
    ]);
    return {
      etablissementId: change.etablissementId,
      etablissementName: names.get(change.etablissementId ?? "") ?? null,
      secondaryEtablissementId: change.secondaryEtablissementId ?? null,
      secondaryEtablissementName:
        names.get(change.secondaryEtablissementId ?? "") ?? null,
    };
  }
  if (change.type === "type_transport") {
    return {
      transportType: change.transportType,
      transportTypeLabel:
        USAGER_TRANSPORT_TYPE_LABELS[
          change.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
        ] ?? change.transportType,
    };
  }
  if (change.type === "circuit") {
    const c = await ctx.db
      .select({ name: circuits.name })
      .from(circuits)
      .where(
        and(
          eq(circuits.id, change.circuitId),
          eq(circuits.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);
    return {
      circuitId: change.circuitId,
      circuitName: c[0]?.name ?? null,
      usagerAddressId: change.usagerAddressId ?? null,
    };
  }
  if (change.type === "jours_pec") {
    // circuitId resolved from the targeted assignment
    const uc = await ctx.db
      .select({ circuitId: usagerCircuits.circuitId })
      .from(usagerCircuits)
      .where(
        and(
          eq(usagerCircuits.id, change.usagerCircuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);
    return {
      circuitId: uc[0]?.circuitId ?? "",
      daysAller: change.daysAller,
      daysRetour: change.daysRetour,
    };
  }
  // "adresse" change
  const a = await readAddress(ctx, change.usagerAddressId);
  return {
    usagerAddressId: change.usagerAddressId,
    address: a?.address ?? null,
    city: a?.city ?? null,
    postalCode: a?.postalCode ?? null,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
    type: a?.type ?? null,
  };
}

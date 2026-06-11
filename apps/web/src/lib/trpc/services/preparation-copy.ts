import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  circuits,
  trajets,
  arrets,
  usagers,
  usagerAddresses,
  usagerCircuits,
  preparationCampaigns,
} from "@scomap/db/schema";
import { nextDisplayId } from "@/lib/db/display-id";

/**
 * "Production → preparation" copy. Clones trees (circuit→trajets→arrêts,
 * usager→addresses→assignments) into a campaign, re-allocating displayIds,
 * resetting statuses/dates/resource assignments, and WITHOUT carrying over
 * avenants. All FKs point to the copies (never to production).
 *
 * Key safeguards:
 * - only one copy of a usager/circuit per campaign (dedup via source_id);
 * - everything filtered by tenant + production (preparation_campaign_id IS NULL).
 */

type Tx = Parameters<
  Parameters<typeof import("@scomap/db").db.transaction>[0]
>[0];

type Ctx = { db: typeof import("@scomap/db").db; tenantId: string };

interface CopyMaps {
  // prodId -> prepaId, shared across the whole operation (multi-circuit dedup).
  usagers: Map<string, string>;
  addresses: Map<string, string>;
}

function dayBefore(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Clones (or retrieves) a production usager into the campaign, with their addresses. */
async function getOrCreatePrepaUsager(
  tx: Tx,
  ctx: Ctx,
  campaignId: string,
  prodUsagerId: string,
  maps: CopyMaps,
): Promise<string | null> {
  const cached = maps.usagers.get(prodUsagerId);
  if (cached) return cached;

  // Already copied in a previous operation? (persistent dedup via source_id)
  const existing = await tx
    .select({ id: usagers.id })
    .from(usagers)
    .where(
      and(
        eq(usagers.tenantId, ctx.tenantId),
        eq(usagers.preparationCampaignId, campaignId),
        eq(usagers.sourceId, prodUsagerId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const prepaId = existing[0].id;
    maps.usagers.set(prodUsagerId, prepaId);
    // Rebuild the address map by position (prod <-> prépa).
    const prodAddrs = await tx
      .select({ id: usagerAddresses.id, position: usagerAddresses.position })
      .from(usagerAddresses)
      .where(eq(usagerAddresses.usagerId, prodUsagerId));
    const prepaAddrs = await tx
      .select({ id: usagerAddresses.id, position: usagerAddresses.position })
      .from(usagerAddresses)
      .where(eq(usagerAddresses.usagerId, prepaId));
    const byPos = new Map(prepaAddrs.map((a) => [a.position, a.id]));
    for (const pa of prodAddrs) {
      const match = byPos.get(pa.position);
      if (match) maps.addresses.set(pa.id, match);
    }
    return prepaId;
  }

  // Load the production usager (tenant + production).
  const prodRows = await tx
    .select()
    .from(usagers)
    .where(
      and(
        eq(usagers.id, prodUsagerId),
        eq(usagers.tenantId, ctx.tenantId),
        isNull(usagers.preparationCampaignId),
        isNull(usagers.deletedAt),
      ),
    )
    .limit(1);
  const prod = prodRows[0];
  if (!prod) return null;

  const displayId = await nextDisplayId(tx, ctx.tenantId, "usagers");
  const {
    id: _id,
    displayId: _did,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = prod;
  void _id;
  void _did;
  void _c;
  void _u;
  const insertedUsager = await tx
    .insert(usagers)
    .values({
      ...rest,
      displayId,
      // Copy in préparation → status "À reconduire" (Transcolaire style).
      status: "a_reconduire",
      archivedAt: null,
      // Transport dates reset to zero (recalibrated for the new school year).
      transportStartDate: null,
      transportEndDate: null,
      preparationCampaignId: campaignId,
      sourceId: prod.id,
      deletedAt: null,
    })
    .returning({ id: usagers.id });
  const prepaUsagerId = insertedUsager[0]!.id;
  maps.usagers.set(prodUsagerId, prepaUsagerId);

  // Clone all addresses of the usager (full isolation).
  const prodAddrs = await tx
    .select()
    .from(usagerAddresses)
    .where(eq(usagerAddresses.usagerId, prodUsagerId));
  for (const a of prodAddrs) {
    const { id: _aid, usagerId: _uid, createdAt: _ac, updatedAt: _au, ...arest } = a;
    void _aid;
    void _uid;
    void _ac;
    void _au;
    const insertedAddr = await tx
      .insert(usagerAddresses)
      .values({ ...arest, usagerId: prepaUsagerId })
      .returning({ id: usagerAddresses.id });
    maps.addresses.set(a.id, insertedAddr[0]!.id);
  }

  return prepaUsagerId;
}

/** Clones a production circuit (cascade trajets, arrêts, usagers, assignments) into the campaign. */
async function copyOneCircuit(
  tx: Tx,
  ctx: Ctx,
  campaign: typeof preparationCampaigns.$inferSelect,
  prodCircuitId: string,
  maps: CopyMaps,
): Promise<boolean> {
  const campaignId = campaign.id;
  const targetStart = campaign.targetStartDate ?? null;
  const targetEnd = campaign.targetEndDate ?? null;

  // Dedup: circuit already copied into this campaign?
  const dup = await tx
    .select({ id: circuits.id })
    .from(circuits)
    .where(
      and(
        eq(circuits.tenantId, ctx.tenantId),
        eq(circuits.preparationCampaignId, campaignId),
        eq(circuits.sourceId, prodCircuitId),
      ),
    )
    .limit(1);
  if (dup[0]) return false;

  const prodRows = await tx
    .select()
    .from(circuits)
    .where(
      and(
        eq(circuits.id, prodCircuitId),
        eq(circuits.tenantId, ctx.tenantId),
        isNull(circuits.preparationCampaignId),
        isNull(circuits.deletedAt),
      ),
    )
    .limit(1);
  const prod = prodRows[0];
  if (!prod) return false;

  // 1. Clone the circuit.
  const circuitDisplayId = await nextDisplayId(tx, ctx.tenantId, "circuits");
  let prepaCircuitId: string;
  {
    const { id: _id, displayId: _d, createdAt: _c, updatedAt: _u, ...rest } = prod;
    void _id;
    void _d;
    void _c;
    void _u;
    const inserted = await tx
      .insert(circuits)
      .values({
        ...rest,
        displayId: circuitDisplayId,
        status: "non_controle",
        archivedAt: null,
        startDate: targetStart,
        endDate: targetEnd,
        preparationCampaignId: campaignId,
        sourceId: prod.id,
      })
      .returning({ id: circuits.id });
    prepaCircuitId = inserted[0]!.id;
  }

  // 2. Clone the open assignments (usager_circuits) + usagers/addresses.
  const openUC = await tx
    .select()
    .from(usagerCircuits)
    .where(
      and(
        eq(usagerCircuits.tenantId, ctx.tenantId),
        eq(usagerCircuits.circuitId, prodCircuitId),
        isNull(usagerCircuits.preparationCampaignId),
        isNull(usagerCircuits.validTo),
        isNull(usagerCircuits.deletedAt),
      ),
    );
  for (const uc of openUC) {
    const prepaUsagerId = await getOrCreatePrepaUsager(
      tx,
      ctx,
      campaignId,
      uc.usagerId,
      maps,
    );
    if (!prepaUsagerId) continue;
    const prepaAddressId = uc.usagerAddressId
      ? (maps.addresses.get(uc.usagerAddressId) ?? null)
      : null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = uc;
    void _id;
    void _c;
    void _u;
    await tx.insert(usagerCircuits).values({
      ...rest,
      usagerId: prepaUsagerId,
      circuitId: prepaCircuitId,
      usagerAddressId: prepaAddressId,
      validFrom: targetStart,
      validTo: null,
      preparationCampaignId: campaignId,
      deletedAt: null,
    });
  }

  // 3. Clone the trajets (chauffeur/véhicule cleared, dates recalibrated).
  const prodTrajets = await tx
    .select()
    .from(trajets)
    .where(
      and(
        eq(trajets.tenantId, ctx.tenantId),
        eq(trajets.circuitId, prodCircuitId),
        isNull(trajets.preparationCampaignId),
        isNull(trajets.deletedAt),
      ),
    );
  const trajetMap = new Map<string, string>();
  for (const t of prodTrajets) {
    const tDisplayId = await nextDisplayId(tx, ctx.tenantId, "trajets");
    const { id: _id, displayId: _d, createdAt: _c, updatedAt: _u, ...rest } = t;
    void _id;
    void _d;
    void _c;
    void _u;
    const inserted = await tx
      .insert(trajets)
      .values({
        ...rest,
        displayId: tDisplayId,
        circuitId: prepaCircuitId,
        createdByAvenantId: null,
        chauffeurId: null,
        vehiculeId: null,
        startDate: targetStart,
        endDate: targetEnd,
        preparationCampaignId: campaignId,
      })
      .returning({ id: trajets.id });
    trajetMap.set(t.id, inserted[0]!.id);
  }

  // 4. Clone the arrêts (linked to the copied trajets + copied addresses).
  if (prodTrajets.length > 0) {
    const prodArrets = await tx
      .select()
      .from(arrets)
      .where(
        and(
          eq(arrets.tenantId, ctx.tenantId),
          inArray(
            arrets.trajetId,
            prodTrajets.map((t) => t.id),
          ),
          isNull(arrets.deletedAt),
        ),
      );
    for (const a of prodArrets) {
      const prepaTrajetId = trajetMap.get(a.trajetId);
      if (!prepaTrajetId) continue;
      const prepaAddressId = a.usagerAddressId
        ? (maps.addresses.get(a.usagerAddressId) ?? null)
        : null;
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = a;
      void _id;
      void _c;
      void _u;
      await tx.insert(arrets).values({
        ...rest,
        trajetId: prepaTrajetId,
        usagerAddressId: prepaAddressId,
        validFrom: null,
        validTo: null,
        preparationCampaignId: campaignId,
        deletedAt: null,
      });
    }
  }

  return true;
}

async function loadOpenCampaign(tx: Tx, ctx: Ctx, campaignId: string) {
  const rows = await tx
    .select()
    .from(preparationCampaigns)
    .where(
      and(
        eq(preparationCampaigns.id, campaignId),
        eq(preparationCampaigns.tenantId, ctx.tenantId),
        eq(preparationCampaigns.status, "en_cours"),
        isNull(preparationCampaigns.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Copies a list of production circuits into the campaign. */
export async function copyCircuitsToCampaign(
  ctx: Ctx,
  campaignId: string,
  circuitIds: string[],
): Promise<{ copied: number }> {
  if (circuitIds.length === 0) return { copied: 0 };
  return ctx.db.transaction(async (tx) => {
    const campaign = await loadOpenCampaign(tx, ctx, campaignId);
    if (!campaign) return { copied: 0 };
    const maps: CopyMaps = { usagers: new Map(), addresses: new Map() };
    let copied = 0;
    for (const id of circuitIds) {
      if (await copyOneCircuit(tx, ctx, campaign, id, maps)) copied++;
    }
    return { copied };
  });
}

/** Copies a list of production usagers (without circuit assignment) into the campaign. */
export async function copyUsagersToCampaign(
  ctx: Ctx,
  campaignId: string,
  usagerIds: string[],
): Promise<{ copied: number }> {
  if (usagerIds.length === 0) return { copied: 0 };
  return ctx.db.transaction(async (tx) => {
    const campaign = await loadOpenCampaign(tx, ctx, campaignId);
    if (!campaign) return { copied: 0 };
    const maps: CopyMaps = { usagers: new Map(), addresses: new Map() };
    let copied = 0;
    for (const id of usagerIds) {
      const before = maps.usagers.size;
      await getOrCreatePrepaUsager(tx, ctx, campaignId, id, maps);
      if (maps.usagers.size > before) copied++;
    }
    return { copied };
  });
}

/** Copies the ENTIRE production (all circuits + all usagers) into the campaign. */
export async function copyAllToCampaign(
  ctx: Ctx,
  campaignId: string,
): Promise<{ circuits: number; usagers: number }> {
  return ctx.db.transaction(async (tx) => {
    const campaign = await loadOpenCampaign(tx, ctx, campaignId);
    if (!campaign) return { circuits: 0, usagers: 0 };
    const maps: CopyMaps = { usagers: new Map(), addresses: new Map() };

    const prodCircuits = await tx
      .select({ id: circuits.id })
      .from(circuits)
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          isNull(circuits.preparationCampaignId),
          isNull(circuits.deletedAt),
          isNull(circuits.archivedAt),
        ),
      );
    let circuitsCopied = 0;
    for (const c of prodCircuits) {
      if (await copyOneCircuit(tx, ctx, campaign, c.id, maps)) circuitsCopied++;
    }

    // Unassigned usagers (not yet cloned via a circuit).
    const prodUsagers = await tx
      .select({ id: usagers.id })
      .from(usagers)
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          isNull(usagers.preparationCampaignId),
          isNull(usagers.deletedAt),
          isNull(usagers.archivedAt),
        ),
      );
    for (const u of prodUsagers) {
      await getOrCreatePrepaUsager(tx, ctx, campaignId, u.id, maps);
    }

    return { circuits: circuitsCopied, usagers: maps.usagers.size };
  });
}

/**
 * Activates the campaign: archives the replaced production (by source_id) and
 * promotes the copies to production (preparation_campaign_id = NULL). Single transaction.
 */
export async function activateCampaign(
  ctx: Ctx,
  campaignId: string,
): Promise<{ ok: boolean }> {
  return ctx.db.transaction(async (tx) => {
    const campaign = await loadOpenCampaign(tx, ctx, campaignId);
    if (!campaign) return { ok: false };
    const now = new Date();
    const closeAt = campaign.targetStartDate
      ? dayBefore(campaign.targetStartDate)
      : now.toISOString().slice(0, 10);

    // Production circuits/usagers replaced by a copy from the campaign.
    const prepaCircuits = await tx
      .select({ sourceId: circuits.sourceId })
      .from(circuits)
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          eq(circuits.preparationCampaignId, campaignId),
        ),
      );
    const replacedCircuitIds = prepaCircuits
      .map((c) => c.sourceId)
      .filter((id): id is string => !!id);

    const prepaUsagers = await tx
      .select({ sourceId: usagers.sourceId })
      .from(usagers)
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          eq(usagers.preparationCampaignId, campaignId),
        ),
      );
    const replacedUsagerIds = prepaUsagers
      .map((u) => u.sourceId)
      .filter((id): id is string => !!id);

    // 1. Archive the replaced production + close its open assignments.
    if (replacedCircuitIds.length > 0) {
      await tx
        .update(circuits)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(circuits.tenantId, ctx.tenantId),
            inArray(circuits.id, replacedCircuitIds),
            isNull(circuits.preparationCampaignId),
          ),
        );
      await tx
        .update(usagerCircuits)
        .set({ validTo: closeAt, updatedAt: now })
        .where(
          and(
            eq(usagerCircuits.tenantId, ctx.tenantId),
            inArray(usagerCircuits.circuitId, replacedCircuitIds),
            isNull(usagerCircuits.preparationCampaignId),
            isNull(usagerCircuits.validTo),
            isNull(usagerCircuits.deletedAt),
          ),
        );
    }
    if (replacedUsagerIds.length > 0) {
      await tx
        .update(usagers)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(usagers.tenantId, ctx.tenantId),
            inArray(usagers.id, replacedUsagerIds),
            isNull(usagers.preparationCampaignId),
          ),
        );
    }

    // 2. Promote the copies to production (campaign FK → NULL).
    const promote = { preparationCampaignId: null, updatedAt: now };
    await tx
      .update(circuits)
      .set(promote)
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          eq(circuits.preparationCampaignId, campaignId),
        ),
      );
    await tx
      .update(usagers)
      .set(promote)
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          eq(usagers.preparationCampaignId, campaignId),
        ),
      );
    await tx
      .update(usagerCircuits)
      .set(promote)
      .where(
        and(
          eq(usagerCircuits.tenantId, ctx.tenantId),
          eq(usagerCircuits.preparationCampaignId, campaignId),
        ),
      );
    await tx
      .update(trajets)
      .set(promote)
      .where(
        and(
          eq(trajets.tenantId, ctx.tenantId),
          eq(trajets.preparationCampaignId, campaignId),
        ),
      );
    await tx
      .update(arrets)
      .set(promote)
      .where(
        and(
          eq(arrets.tenantId, ctx.tenantId),
          eq(arrets.preparationCampaignId, campaignId),
        ),
      );

    // 3. Mark the campaign as activated.
    await tx
      .update(preparationCampaigns)
      .set({ status: "activee", activatedAt: now, updatedAt: now })
      .where(
        and(
          eq(preparationCampaigns.id, campaignId),
          eq(preparationCampaigns.tenantId, ctx.tenantId),
        ),
      );

    return { ok: true };
  });
}

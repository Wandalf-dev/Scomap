import { eq, and } from "drizzle-orm";
import { circuits, etablissements, arrets } from "@scomap/db/schema";
import { assertTenantOwned } from "../../ownership";

// Anti-IDOR guard: checks that a circuitId provided as input does belong to the tenant
export async function assertCircuitOwned(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  circuitId: string,
) {
  await assertTenantOwned(ctx.db, circuits, circuitId, ctx.tenantId, "Circuit");
}

// Helper: auto-create an "etablissement" stop when creating a trajet
export async function autoCreateEtablissementArret(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  trajetId: string,
  circuitId: string,
) {
  // Fetch the circuit's etablissement — tenant filter on the circuit AND
  // the join: without it, a circuitId from another tenant would exfiltrate
  // its etablissement's address (cross-tenant IDOR)
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
    .leftJoin(
      etablissements,
      and(
        eq(circuits.etablissementId, etablissements.id),
        eq(etablissements.tenantId, ctx.tenantId),
      ),
    )
    .where(and(eq(circuits.id, circuitId), eq(circuits.tenantId, ctx.tenantId)))
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

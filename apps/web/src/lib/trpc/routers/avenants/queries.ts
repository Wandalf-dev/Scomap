import { z } from "zod";
import { eq, and, or, isNull, desc, inArray } from "drizzle-orm";
import {
  avenants,
  avenantChanges,
  usagers,
  usagerCircuits,
  circuits,
} from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { assertAvenantOwned } from "./helpers";

export const listByUsager = tenantProcedure
  .input(z.object({ usagerId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // Circuits the usager is assigned to (open versions).
    const circuitRows = await ctx.db
      .select({ circuitId: usagerCircuits.circuitId })
      .from(usagerCircuits)
      .where(
        and(
          eq(usagerCircuits.usagerId, input.usagerId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          isNull(usagerCircuits.validTo),
          isNull(usagerCircuits.deletedAt),
        ),
      );
    const circuitIds = [...new Set(circuitRows.map((r) => r.circuitId))];

    // Visible for this usager: their OWN changes OR any avenant targeting a
    // circuit they are assigned to (even if the subject is ANOTHER usager of
    // the circuit — important to see the circuit's shared history). Usagers
    // are joined to display who each change belongs to.
    const visibleFilter =
      circuitIds.length > 0
        ? or(
            eq(avenantChanges.usagerId, input.usagerId),
            inArray(avenants.circuitId, circuitIds),
          )
        : eq(avenantChanges.usagerId, input.usagerId);

    const rows = await ctx.db
      .select({
        changeId: avenantChanges.id,
        type: avenantChanges.type,
        previousValue: avenantChanges.previousValue,
        newValue: avenantChanges.newValue,
        usagerCircuitId: avenantChanges.usagerCircuitId,
        usagerId: avenantChanges.usagerId,
        usagerFirstName: usagers.firstName,
        usagerLastName: usagers.lastName,
        avenantId: avenants.id,
        displayId: avenants.displayId,
        circuitSequence: avenants.circuitSequence,
        circuitId: avenants.circuitId,
        circuitCode: circuits.code,
        circuitName: circuits.name,
        circuitStartDate: circuits.startDate,
        effectiveDate: avenants.effectiveDate,
        endDate: avenants.endDate,
        reason: avenants.reason,
        status: avenants.status,
        appliedAt: avenants.appliedAt,
        createdAt: avenants.createdAt,
      })
      .from(avenantChanges)
      .innerJoin(avenants, eq(avenantChanges.avenantId, avenants.id))
      // Re-filter tenant on the joins (anti-IDOR via injected FK)
      .innerJoin(
        usagers,
        and(
          eq(avenantChanges.usagerId, usagers.id),
          eq(usagers.tenantId, ctx.tenantId),
        ),
      )
      .leftJoin(
        circuits,
        and(eq(avenants.circuitId, circuits.id), eq(circuits.tenantId, ctx.tenantId)),
      )
      .where(
        and(
          eq(avenants.tenantId, ctx.tenantId),
          isNull(avenants.deletedAt),
          visibleFilter,
        ),
      )
      .orderBy(desc(avenants.effectiveDate), desc(avenants.createdAt));
    return rows;
  });

export const listByCircuit = tenantProcedure
  .input(z.object({ circuitId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const headers = await ctx.db
      .select({
        id: avenants.id,
        displayId: avenants.displayId,
        circuitSequence: avenants.circuitSequence,
        effectiveDate: avenants.effectiveDate,
        endDate: avenants.endDate,
        reason: avenants.reason,
        status: avenants.status,
        appliedAt: avenants.appliedAt,
        createdAt: avenants.createdAt,
      })
      .from(avenants)
      .where(
        and(
          eq(avenants.circuitId, input.circuitId),
          eq(avenants.tenantId, ctx.tenantId),
          isNull(avenants.deletedAt),
        ),
      )
      .orderBy(desc(avenants.effectiveDate), desc(avenants.createdAt));

    if (headers.length === 0) return [];

    // Change details (per usager) of these avenants.
    const changes = await ctx.db
      .select({
        changeId: avenantChanges.id,
        avenantId: avenantChanges.avenantId,
        type: avenantChanges.type,
        previousValue: avenantChanges.previousValue,
        newValue: avenantChanges.newValue,
        usagerId: avenantChanges.usagerId,
        usagerFirstName: usagers.firstName,
        usagerLastName: usagers.lastName,
      })
      .from(avenantChanges)
      .innerJoin(
        usagers,
        and(
          eq(avenantChanges.usagerId, usagers.id),
          eq(usagers.tenantId, ctx.tenantId),
        ),
      )
      .where(
        and(
          inArray(
            avenantChanges.avenantId,
            headers.map((h) => h.id),
          ),
          eq(avenantChanges.tenantId, ctx.tenantId),
        ),
      );

    type ChangeRowOut = (typeof changes)[number];
    const byAvenant = new Map<string, ChangeRowOut[]>();
    for (const c of changes) {
      const arr = byAvenant.get(c.avenantId) ?? [];
      arr.push(c);
      byAvenant.set(c.avenantId, arr);
    }

    return headers.map((h) => ({
      ...h,
      changes: byAvenant.get(h.id) ?? [],
    }));
  });

export const getById = tenantProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const header = await assertAvenantOwned(ctx, input.id);
    const changes = await ctx.db
      .select()
      .from(avenantChanges)
      .where(eq(avenantChanges.avenantId, input.id));
    return { ...header, changes };
  });

import { eq, and, isNull, sql } from "drizzle-orm";
import { avenants, avenantChanges, usagers, circuits } from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../../init";
import { assertTenantOwned } from "../../ownership";
import { nextDisplayId } from "@/lib/db/display-id";
import { avenantCreateSchema } from "@/lib/validators/avenant";
import { applyChange } from "./apply-change";
import { assertEffectiveDateWithinBounds } from "./helpers";
import { buildNewValue, capturePrevious } from "./snapshots";

export const create = tenantProcedure
  .input(avenantCreateSchema)
  .mutation(async ({ ctx, input }) => {
    // Anti-IDOR: the referenced circuit and each referenced usager must belong
    // to the tenant (otherwise the avenant would persist foreign FKs that the
    // read joins would expose).
    await Promise.all([
      input.circuitId
        ? assertTenantOwned(ctx.db, circuits, input.circuitId, ctx.tenantId, "Circuit")
        : null,
      ...input.changes.map((change) =>
        assertTenantOwned(ctx.db, usagers, change.usagerId, ctx.tenantId, "Usager"),
      ),
    ]);

    // Date guard: the effective date must respect the bounds of the circuit
    // and of the usagers (transport start/end) — otherwise an out-of-period
    // assignment version would be created.
    await assertEffectiveDateWithinBounds(ctx, input);

    // Auto-merge: if a (non-cancelled) avenant already exists on the same
    // circuit at the same effective date, the changes are ATTACHED to that
    // avenant instead of creating a new one. Allows grouping several usagers
    // of the same circuit modified on the same day under a single « Avenant n°N ».
    let existing: typeof avenants.$inferSelect | null = null;
    if (input.circuitId) {
      const found = await ctx.db
        .select()
        .from(avenants)
        .where(
          and(
            eq(avenants.circuitId, input.circuitId),
            eq(avenants.effectiveDate, input.effectiveDate),
            eq(avenants.tenantId, ctx.tenantId),
            isNull(avenants.deletedAt),
          ),
        )
        .limit(1);
      existing = found[0] ?? null;
    }

    let avenant: typeof avenants.$inferSelect;
    if (existing) {
      avenant = existing;
      // Anti-duplicate: the same usager cannot have the same change type twice
      // on the same avenant (otherwise it would be applied twice).
      const prior = await ctx.db
        .select({
          usagerId: avenantChanges.usagerId,
          type: avenantChanges.type,
        })
        .from(avenantChanges)
        .where(eq(avenantChanges.avenantId, avenant.id));
      const seen = new Set(prior.map((c) => `${c.usagerId}:${c.type}`));
      for (const change of input.changes) {
        if (seen.has(`${change.usagerId}:${change.type}`)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Un changement de ce type pour cet usager existe déjà sur l'avenant de cette date.",
          });
        }
      }
    } else {
      const displayId = await nextDisplayId(ctx.db, ctx.tenantId, "avenants");
      // Avenant number WITHIN the circuit (sequence specific to the circuit).
      let circuitSequence: number | null = null;
      if (input.circuitId) {
        const seq = await ctx.db
          .select({
            max: sql<number>`coalesce(max(${avenants.circuitSequence}), 0)`,
          })
          .from(avenants)
          .where(
            and(
              eq(avenants.circuitId, input.circuitId),
              eq(avenants.tenantId, ctx.tenantId),
            ),
          );
        circuitSequence = (seq[0]?.max ?? 0) + 1;
      }

      const inserted = await ctx.db
        .insert(avenants)
        .values({
          tenantId: ctx.tenantId,
          displayId,
          circuitId: input.circuitId ?? null,
          circuitSequence,
          effectiveDate: input.effectiveDate,
          endDate: input.endDate ?? null,
          reason: input.reason,
          // No "planned" status: the avenant is recorded as coexisting dated
          // versions. The switch on day D is resolved by date.
          status: "actif",
          appliedAt: new Date(),
          createdByUserId: ctx.user.id,
        })
        .returning();
      avenant = inserted[0]!;
    }

    // Insert the NEW changes then apply ONLY those
    // (when merging, do not re-apply the changes already present).
    const newChanges: (typeof avenantChanges.$inferSelect)[] = [];
    for (const change of input.changes) {
      const previousValue = await capturePrevious(ctx, change);
      const newValue = await buildNewValue(ctx, change);
      const ins = await ctx.db
        .insert(avenantChanges)
        .values({
          tenantId: ctx.tenantId,
          avenantId: avenant.id,
          usagerId: change.usagerId,
          type: change.type,
          usagerCircuitId:
            "usagerCircuitId" in change ? change.usagerCircuitId : null,
          usagerAddressId:
            "usagerAddressId" in change
              ? (change.usagerAddressId ?? null)
              : null,
          previousValue,
          newValue,
        })
        .returning();
      if (ins[0]) newChanges.push(ins[0]);
    }

    // UNIFORM application (past/present/future): coexisting dated versions.
    for (const c of newChanges) await applyChange(ctx, c, input.effectiveDate);

    return avenant;
  });

import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  preparationCampaigns,
  circuits,
  usagers,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  copyCircuitsToCampaign,
  copyUsagersToCampaign,
  copyAllToCampaign,
  activateCampaign,
} from "../services/preparation-copy";

export const preparationRouter = createTRPCRouter({
  // Campagne « en cours » du tenant (+ compteurs), ou null.
  getCurrentCampaign: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(preparationCampaigns)
      .where(
        and(
          eq(preparationCampaigns.tenantId, ctx.tenantId),
          eq(preparationCampaigns.status, "en_cours"),
          isNull(preparationCampaigns.deletedAt),
        ),
      )
      .limit(1);
    const campaign = rows[0];
    if (!campaign) return null;

    const [c] = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(circuits)
      .where(
        and(
          eq(circuits.tenantId, ctx.tenantId),
          eq(circuits.preparationCampaignId, campaign.id),
          isNull(circuits.deletedAt),
        ),
      );
    const [u] = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(usagers)
      .where(
        and(
          eq(usagers.tenantId, ctx.tenantId),
          eq(usagers.preparationCampaignId, campaign.id),
          isNull(usagers.deletedAt),
        ),
      );

    return {
      ...campaign,
      circuitCount: c?.n ?? 0,
      usagerCount: u?.n ?? 0,
    };
  }),

  startCampaign: tenantProcedure
    .input(
      z.object({
        label: z.string().min(1, "Libellé requis"),
        schoolYearLabel: z.string().optional(),
        targetStartDate: z.string().nullable().optional(),
        targetEndDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Une seule campagne en cours par tenant.
      const existing = await ctx.db
        .select({ id: preparationCampaigns.id })
        .from(preparationCampaigns)
        .where(
          and(
            eq(preparationCampaigns.tenantId, ctx.tenantId),
            eq(preparationCampaigns.status, "en_cours"),
            isNull(preparationCampaigns.deletedAt),
          ),
        )
        .limit(1);
      if (existing[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Une préparation est déjà en cours.",
        });
      }
      const result = await ctx.db
        .insert(preparationCampaigns)
        .values({
          tenantId: ctx.tenantId,
          label: input.label,
          schoolYearLabel: input.schoolYearLabel || null,
          targetStartDate: input.targetStartDate || null,
          targetEndDate: input.targetEndDate || null,
          status: "en_cours",
          createdByUserId: ctx.user.id,
        })
        .returning();
      return result[0];
    }),

  abandonCampaign: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(preparationCampaigns)
        .set({ status: "abandonnee", deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(preparationCampaigns.id, input.id),
            eq(preparationCampaigns.tenantId, ctx.tenantId),
            eq(preparationCampaigns.status, "en_cours"),
          ),
        )
        .returning();
      return result[0] ?? null;
    }),

  copyCircuits: tenantProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        circuitIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      copyCircuitsToCampaign(ctx, input.campaignId, input.circuitIds),
    ),

  copyUsagers: tenantProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        usagerIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      copyUsagersToCampaign(ctx, input.campaignId, input.usagerIds),
    ),

  copyAll: tenantProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      copyAllToCampaign(ctx, input.campaignId),
    ),

  activate: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const res = await activateCampaign(ctx, input.id);
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Activation impossible (campagne introuvable ou déjà activée).",
        });
      }
      return res;
    }),
});

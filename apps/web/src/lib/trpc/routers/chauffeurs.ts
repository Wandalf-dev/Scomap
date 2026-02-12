import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chauffeurs } from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  chauffeurSchema,
  chauffeurDetailSchema,
  chauffeurDocumentsSchema,
} from "@/lib/validators/chauffeur";

export const chauffeursRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: chauffeurs.id,
        firstName: chauffeurs.firstName,
        lastName: chauffeurs.lastName,
        email: chauffeurs.email,
        phone: chauffeurs.phone,
        isActive: chauffeurs.isActive,
        createdAt: chauffeurs.createdAt,
        updatedAt: chauffeurs.updatedAt,
      })
      .from(chauffeurs)
      .where(
        and(
          eq(chauffeurs.tenantId, ctx.tenantId),
          isNull(chauffeurs.deletedAt),
        ),
      );
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: chauffeurs.id,
          firstName: chauffeurs.firstName,
          lastName: chauffeurs.lastName,
          email: chauffeurs.email,
          phone: chauffeurs.phone,
          address: chauffeurs.address,
          licenseNumber: chauffeurs.licenseNumber,
          licenseExpiry: chauffeurs.licenseExpiry,
          medicalCertificateExpiry: chauffeurs.medicalCertificateExpiry,
          hireDate: chauffeurs.hireDate,
          notes: chauffeurs.notes,
          isActive: chauffeurs.isActive,
          createdAt: chauffeurs.createdAt,
          updatedAt: chauffeurs.updatedAt,
        })
        .from(chauffeurs)
        .where(
          and(
            eq(chauffeurs.id, input.id),
            eq(chauffeurs.tenantId, ctx.tenantId),
            isNull(chauffeurs.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(chauffeurSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(chauffeurs)
        .values({
          tenantId: ctx.tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone || null,
          email: input.email === "" ? null : input.email,
        })
        .returning();

      return result[0];
    }),

  createFull: tenantProcedure
    .input(chauffeurDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(chauffeurs)
        .values({
          tenantId: ctx.tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email === "" ? null : input.email,
          phone: input.phone || null,
          address: input.address || null,
          hireDate: input.hireDate || null,
          notes: input.notes || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Echec de la creation" });
      }
      return created;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: chauffeurSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(chauffeurs)
        .set({
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          phone: input.data.phone || null,
          email: input.data.email === "" ? null : input.data.email,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chauffeurs.id, input.id),
            eq(chauffeurs.tenantId, ctx.tenantId),
            isNull(chauffeurs.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: chauffeurDetailSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(chauffeurs)
        .set({
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          email: input.data.email === "" ? null : input.data.email,
          phone: input.data.phone || null,
          address: input.data.address || null,
          hireDate: input.data.hireDate || null,
          notes: input.data.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chauffeurs.id, input.id),
            eq(chauffeurs.tenantId, ctx.tenantId),
            isNull(chauffeurs.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDocuments: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: chauffeurDocumentsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(chauffeurs)
        .set({
          licenseNumber: input.data.licenseNumber || null,
          licenseExpiry: input.data.licenseExpiry || null,
          medicalCertificateExpiry: input.data.medicalCertificateExpiry || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chauffeurs.id, input.id),
            eq(chauffeurs.tenantId, ctx.tenantId),
            isNull(chauffeurs.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(chauffeurs)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(chauffeurs.id, input.id),
            eq(chauffeurs.tenantId, ctx.tenantId),
            isNull(chauffeurs.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

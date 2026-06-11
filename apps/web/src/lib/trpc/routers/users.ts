import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { eq, and, asc } from "drizzle-orm";
import { users, tenants } from "@scomap/db/schema";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
  protectedProcedure,
} from "../init";
import {
  userCreateSchema,
  userProfileUpdateSchema,
  changePasswordSchema,
  USER_ROLES,
} from "@/lib/validators/user";

export const usersRouter = createTRPCRouter({
  // Current user profile + their organisation, for the "My account" page
  me: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        tenantDescription: tenants.description,
        tenantCreatedAt: tenants.createdAt,
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(eq(users.id, ctx.user.id as string))
      .limit(1);

    const me = rows[0];
    if (!me) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Compte introuvable" });
    }
    return me;
  }),

  updateProfile: protectedProcedure
    .input(userProfileUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id as string));
      return { ok: true };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, ctx.tenantId))
      .orderBy(asc(users.createdAt));
  }),

  create: adminProcedure
    .input(userCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(eq(users.email, input.email), eq(users.tenantId, ctx.tenantId)),
        )
        .limit(1);
      if (existing[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Un compte existe déjà avec cet email.",
        });
      }

      const passwordHash = await hash(input.password, 12);
      const result = await ctx.db
        .insert(users)
        .values({
          tenantId: ctx.tenantId,
          email: input.email,
          name: `${input.firstName} ${input.lastName}`,
          passwordHash,
          role: input.role,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });
      return result[0];
    }),

  updateRole: adminProcedure
    .input(z.object({ id: z.string().uuid(), role: z.enum(USER_ROLES) }))
    .mutation(async ({ ctx, input }) => {
      // Forbidden on oneself: prevents an admin from downgrading themselves
      // and leaving the tenant without an administrator
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous ne pouvez pas modifier votre propre rôle.",
        });
      }

      const result = await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(
          and(eq(users.id, input.id), eq(users.tenantId, ctx.tenantId)),
        )
        .returning({ id: users.id, role: users.role });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
      }
      return result[0];
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous ne pouvez pas supprimer votre propre compte.",
        });
      }

      // Hard delete: creator FKs (avenants, campaigns) are set to
      // onDelete "set null", business history is preserved. Access is
      // cut immediately (the tRPC context re-checks existence in DB).
      const result = await ctx.db
        .delete(users)
        .where(
          and(eq(users.id, input.id), eq(users.tenantId, ctx.tenantId)),
        )
        .returning({ id: users.id });
      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
      }
      return result[0];
    }),

  // Each user can change their own password
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, ctx.user.id as string))
        .limit(1);

      if (!me[0]?.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Compte introuvable" });
      }
      const valid = await compare(input.currentPassword, me[0].passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mot de passe actuel incorrect.",
        });
      }

      const passwordHash = await hash(input.newPassword, 12);
      await ctx.db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id as string));
      return { ok: true };
    }),
});

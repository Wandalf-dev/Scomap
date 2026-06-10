import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

const hasTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Aucun tenant associé",
    });
  }
  return next({
    ctx: {
      tenantId: ctx.tenantId,
    },
  });
});

// Mutations sensibles (paramètres du tenant, clés d'API…) : admin uniquement
const isAdmin = t.middleware(({ ctx, next }) => {
  if (ctx.session?.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Réservé aux administrateurs",
    });
  }
  return next();
});

export const protectedProcedure = baseProcedure.use(isAuthed);
export const tenantProcedure = baseProcedure.use(isAuthed).use(hasTenant);
export const adminProcedure = tenantProcedure.use(isAdmin);

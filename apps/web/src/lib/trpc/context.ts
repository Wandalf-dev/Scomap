import { cache } from "react";
import { auth } from "@/lib/auth";
import { getTenantSlug } from "@/lib/tenant";
import { db } from "@scomap/db";

export const createTRPCContext = cache(async () => {
  const session = await auth();
  const hostSlug = await getTenantSlug();

  // Défense en profondeur : la session doit correspondre au sous-domaine
  // visité. Un JWT émis pour un autre tenant — ou un ancien token sans slug —
  // est ignoré (toutes les procédures protégées renverront UNAUTHORIZED).
  const sessionMatchesHost =
    session?.user?.tenantSlug != null && session.user.tenantSlug === hostSlug;

  return {
    db,
    session: sessionMatchesHost ? session : null,
    tenantId: sessionMatchesHost ? (session.user.tenantId ?? null) : null,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

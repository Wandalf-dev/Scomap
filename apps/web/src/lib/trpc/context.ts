import { cache } from "react";
import { getValidatedSession } from "@/lib/auth/validated-session";
import { db } from "@scomap/db";

export const createTRPCContext = cache(async () => {
  // Session recroisée avec le sous-domaine et l'existence du compte en DB
  // (défense en profondeur + prise d'effet immédiate des suppressions/rôles)
  const session = await getValidatedSession();

  return {
    db,
    session,
    tenantId: session?.user?.tenantId ?? null,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

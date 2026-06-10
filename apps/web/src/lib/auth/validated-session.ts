import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@scomap/db";
import { users } from "@scomap/db/schema";
import type { Session } from "next-auth";
import { auth } from ".";
import { getTenantSlug } from "../tenant";

/**
 * Session validée : cohérente avec le sous-domaine visité ET adossée à un
 * compte encore présent en DB, avec le rôle relu frais. Un JWT stateless ne
 * reflète ni la suppression d'un compte ni un changement de rôle : sans cette
 * relecture, un utilisateur supprimé garderait l'accès jusqu'à l'expiration
 * du token (7 jours). cache() = une seule requête par render pass.
 */
export const getValidatedSession = cache(
  async (): Promise<Session | null> => {
    const session = await auth();
    const hostSlug = await getTenantSlug();

    if (!session?.user?.tenantSlug || session.user.tenantSlug !== hostSlug) {
      return null;
    }

    const dbUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!dbUser[0]) return null;

    session.user.role = dbUser[0].role;
    return session;
  },
);

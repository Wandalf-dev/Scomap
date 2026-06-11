import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@scomap/db";
import { users } from "@scomap/db/schema";
import type { Session } from "next-auth";
import { auth } from ".";
import { getTenantSlug } from "../tenant";

/**
 * Validated session: consistent with the visited subdomain AND backed by an
 * account still present in the DB, with a freshly re-read role. A stateless JWT
 * reflects neither account deletion nor a role change: without this re-read, a
 * deleted user would retain access until the token expires (7 days).
 * cache() = a single DB query per render pass.
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

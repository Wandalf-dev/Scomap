import { cache } from "react";
import { getValidatedSession } from "@/lib/auth/validated-session";
import { db } from "@scomap/db";

export const createTRPCContext = cache(async () => {
  // Session cross-checked against the subdomain and account existence in DB
  // (defence in depth + immediate effect of deletions/role changes)
  const session = await getValidatedSession();

  return {
    db,
    session,
    tenantId: session?.user?.tenantId ?? null,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

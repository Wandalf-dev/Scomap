import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@scomap/db";

export const createTRPCContext = cache(async () => {
  const session = await auth();

  return {
    db,
    session,
    tenantId: session?.user?.tenantId ?? null,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

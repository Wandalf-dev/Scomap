import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { getValidatedSession } from "@/lib/auth/validated-session";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { ParametresClient } from "@/components/parametres/parametres-client";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  // Role re-read fresh from DB (a JWT may carry a stale role)
  const session = await getValidatedSession();
  const isAdmin = session?.user?.role === "admin";

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.tenantSettings.get.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ParametresClient isAdmin={isAdmin} />
    </HydrationBoundary>
  );
}

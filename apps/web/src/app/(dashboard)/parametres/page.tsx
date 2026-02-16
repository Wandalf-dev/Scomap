import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { ParametresClient } from "@/components/parametres/parametres-client";

export default async function ParametresPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.tenantSettings.get.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ParametresClient />
    </HydrationBoundary>
  );
}

import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { ChauffeursClient } from "@/components/chauffeurs/chauffeurs-client";

export default async function ChauffeursPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.chauffeurs.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChauffeursClient />
    </HydrationBoundary>
  );
}

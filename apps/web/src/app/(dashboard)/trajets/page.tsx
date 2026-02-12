import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { TrajetsClient } from "@/components/trajets/trajets-client";

export default async function TrajetsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.trajets.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TrajetsClient />
    </HydrationBoundary>
  );
}

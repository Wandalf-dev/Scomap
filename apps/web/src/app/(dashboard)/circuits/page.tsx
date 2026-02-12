import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { CircuitsClient } from "@/components/circuits/circuits-client";

export default async function CircuitsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.circuits.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CircuitsClient />
    </HydrationBoundary>
  );
}

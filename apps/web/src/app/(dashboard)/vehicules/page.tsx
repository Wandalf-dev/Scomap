import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { VehiculesClient } from "@/components/vehicules/vehicules-client";

export default async function VehiculesPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.vehicules.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VehiculesClient />
    </HydrationBoundary>
  );
}

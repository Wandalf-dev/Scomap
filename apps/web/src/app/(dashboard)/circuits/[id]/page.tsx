import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { CircuitDetailClient } from "@/components/circuits/circuit-detail-client";

interface CircuitDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CircuitDetailPage({
  params,
}: CircuitDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.circuits.getById.queryOptions({ id })),
    queryClient.prefetchQuery(trpc.arrets.list.queryOptions({ circuitId: id })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CircuitDetailClient id={id} />
    </HydrationBoundary>
  );
}

import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { VehiculeDetailClient } from "@/components/vehicules/vehicule-detail-client";

interface VehiculeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VehiculeDetailPage({
  params,
}: VehiculeDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.vehicules.getById.queryOptions({ id }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VehiculeDetailClient id={id} />
    </HydrationBoundary>
  );
}

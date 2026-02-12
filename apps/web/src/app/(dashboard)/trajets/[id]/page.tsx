import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { TrajetDetailClient } from "@/components/trajets/trajet-detail-client";

interface TrajetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrajetDetailPage({
  params,
}: TrajetDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.trajets.getById.queryOptions({ id })),
    queryClient.prefetchQuery(trpc.arrets.list.queryOptions({ trajetId: id })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TrajetDetailClient id={id} />
    </HydrationBoundary>
  );
}

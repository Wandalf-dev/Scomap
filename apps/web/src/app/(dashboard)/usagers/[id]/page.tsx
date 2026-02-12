import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { UsagerDetailClient } from "@/components/usagers/usager-detail-client";

interface UsagerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UsagerDetailPage({
  params,
}: UsagerDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.usagers.getById.queryOptions({ id })),
    queryClient.prefetchQuery(
      trpc.usagerAddresses.list.queryOptions({ usagerId: id }),
    ),
    queryClient.prefetchQuery(
      trpc.usagerCircuits.listByUsager.queryOptions({ usagerId: id }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsagerDetailClient id={id} />
    </HydrationBoundary>
  );
}

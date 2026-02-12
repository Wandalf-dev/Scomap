import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { ChauffeurDetailClient } from "@/components/chauffeurs/chauffeur-detail-client";

interface ChauffeurDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChauffeurDetailPage({
  params,
}: ChauffeurDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.chauffeurs.getById.queryOptions({ id }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChauffeurDetailClient id={id} />
    </HydrationBoundary>
  );
}

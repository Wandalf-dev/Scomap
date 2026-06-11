import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { ChauffeurDetailClient } from "@/components/chauffeurs/chauffeur-detail-client";

export const metadata: Metadata = { title: "Fiche chauffeur" };

interface ChauffeurDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ChauffeurDetailPage({
  params,
  searchParams,
}: ChauffeurDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.chauffeurs.getById.queryOptions({ id }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChauffeurDetailClient id={id} initialTab={tab} />
    </HydrationBoundary>
  );
}

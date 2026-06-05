import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { TrajetDetailClient } from "@/components/trajets/trajet-detail-client";

export const metadata: Metadata = { title: "Fiche trajet" };

interface TrajetDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}

export default async function TrajetDetailPage({
  params,
  searchParams,
}: TrajetDetailPageProps) {
  const { id } = await params;
  const { back } = await searchParams;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.trajets.getById.queryOptions({ id })),
    queryClient.prefetchQuery(trpc.arrets.list.queryOptions({ trajetId: id })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TrajetDetailClient id={id} backHref={back} />
    </HydrationBoundary>
  );
}

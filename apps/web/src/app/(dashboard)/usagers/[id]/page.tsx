import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { UsagerDetailClient } from "@/components/usagers/usager-detail-client";

export const metadata: Metadata = { title: "Fiche usager" };

interface UsagerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function UsagerDetailPage({
  params,
  searchParams,
}: UsagerDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
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
      <UsagerDetailClient id={id} initialTab={tab} />
    </HydrationBoundary>
  );
}

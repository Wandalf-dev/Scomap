import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { CircuitDetailClient } from "@/components/circuits/circuit-detail-client";

export const metadata: Metadata = { title: "Fiche circuit" };

interface CircuitDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function CircuitDetailPage({
  params,
  searchParams,
}: CircuitDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.circuits.getById.queryOptions({ id })),
    queryClient.prefetchQuery(
      trpc.trajets.listByCircuit.queryOptions({ circuitId: id }),
    ),
    queryClient.prefetchQuery(
      trpc.usagerCircuits.listByCircuit.queryOptions({ circuitId: id }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CircuitDetailClient id={id} initialTab={tab} />
    </HydrationBoundary>
  );
}

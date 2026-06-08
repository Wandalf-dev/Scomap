import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { AvenantDetailClient } from "@/components/avenants/avenant-detail-client";

export const metadata: Metadata = { title: "Avenant — Scomap" };

interface PageProps {
  params: Promise<{ id: string; avenantId: string }>;
}

export default async function CircuitAvenantDetailPage({ params }: PageProps) {
  const { id, avenantId } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(
      trpc.avenants.listByCircuit.queryOptions({ circuitId: id }),
    ),
    queryClient.prefetchQuery(trpc.circuits.getById.queryOptions({ id })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AvenantDetailClient circuitId={id} avenantId={avenantId} />
    </HydrationBoundary>
  );
}

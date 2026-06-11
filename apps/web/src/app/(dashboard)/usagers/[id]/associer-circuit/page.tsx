import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { AssocierCircuitClient } from "@/components/usagers/associer-circuit-client";

export const metadata: Metadata = { title: "Associer un circuit" };

interface AssocierCircuitPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lien?: string }>;
}

export default async function AssocierCircuitPage({
  params,
  searchParams,
}: AssocierCircuitPageProps) {
  const { id } = await params;
  const { lien } = await searchParams;
  const queryClient = getQueryClient();

  const prefetches = [
    queryClient.prefetchQuery(trpc.usagers.getById.queryOptions({ id })),
    queryClient.prefetchQuery(
      trpc.usagerAddresses.list.queryOptions({ usagerId: id }),
    ),
    queryClient.prefetchQuery(trpc.circuits.list.queryOptions()),
    queryClient.prefetchQuery(
      trpc.usagerCircuits.listByUsager.queryOptions({ usagerId: id }),
    ),
    queryClient.prefetchQuery(trpc.etablissements.list.queryOptions()),
  ];
  // Suggestions are useless in edit mode (lien) → skip server-side scoring.
  if (!lien) {
    prefetches.push(
      queryClient.prefetchQuery(
        trpc.usagerCircuits.suggestForUsager.queryOptions({ usagerId: id }),
      ),
    );
  }
  await Promise.all(prefetches);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssocierCircuitClient usagerId={id} usagerCircuitId={lien ?? null} />
    </HydrationBoundary>
  );
}

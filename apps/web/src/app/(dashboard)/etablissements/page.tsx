import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { EtablissementsClient } from "@/components/etablissements/etablissements-client";

export default async function EtablissementsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.etablissements.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EtablissementsClient />
    </HydrationBoundary>
  );
}

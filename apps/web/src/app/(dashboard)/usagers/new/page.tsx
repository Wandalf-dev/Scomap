import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { UsagerCreateClient } from "@/components/usagers/usager-create-client";

export default async function UsagerNewPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.etablissements.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsagerCreateClient />
    </HydrationBoundary>
  );
}

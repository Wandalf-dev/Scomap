import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { UsagersClient } from "@/components/usagers/usagers-client";

export default async function UsagersPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.usagers.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsagersClient />
    </HydrationBoundary>
  );
}

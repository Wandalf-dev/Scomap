import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { CompteClient } from "@/components/compte/compte-client";

export const metadata: Metadata = { title: "Mon compte" };

export default async function ComptePage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.users.me.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompteClient />
    </HydrationBoundary>
  );
}

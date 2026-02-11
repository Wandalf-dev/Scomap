import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { EtablissementDetailClient } from "@/components/etablissements/etablissement-detail-client";

interface EtablissementDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EtablissementDetailPage({
  params,
}: EtablissementDetailPageProps) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(trpc.etablissements.getById.queryOptions({ id })),
    queryClient.prefetchQuery(
      trpc.etablissementContacts.list.queryOptions({ etablissementId: id }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EtablissementDetailClient id={id} />
    </HydrationBoundary>
  );
}

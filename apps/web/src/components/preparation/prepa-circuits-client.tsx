"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { CircuitsClient } from "@/components/circuits/circuits-client";
import { PrepaBanner, NoCampaign } from "./prepa-banner";

export function PrepaCircuitsClient() {
  const trpc = useTRPC();
  const { data: campaign, isLoading } = useQuery(
    trpc.preparation.getCurrentCampaign.queryOptions(),
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!campaign) return <NoCampaign />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PrepaBanner label={campaign.label} />
      <CircuitsClient campaignId={campaign.id} />
    </div>
  );
}

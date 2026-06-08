"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { UsagersClient } from "@/components/usagers/usagers-client";
import { PrepaBanner, NoCampaign } from "./prepa-banner";

export function PrepaUsagersClient() {
  const trpc = useTRPC();
  const { data: campaign, isLoading } = useQuery(
    trpc.preparation.getCurrentCampaign.queryOptions(),
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!campaign) return <NoCampaign />;

  return (
    <div className="space-y-4">
      <PrepaBanner label={campaign.label} />
      <UsagersClient campaignId={campaign.id} />
    </div>
  );
}

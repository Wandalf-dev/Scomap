"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabIdentite } from "./tab-identite";
import { TabAdresses } from "./tab-adresses";
import { TabCircuits } from "./tab-circuits";
import { TabAvenants } from "./tab-avenants";
import { UsagerStatusBadge } from "./usager-status-badge";

interface UsagerDetailClientProps {
  id: string;
}

export function UsagerDetailClient({ id }: UsagerDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: usager, isLoading } = useQuery(
    trpc.usagers.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprimé");
        router.push("/usagers");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={usager}
      backHref="/usagers"
      entityName="Usager"
      title={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      badges={usager && <UsagerStatusBadge status={usager.status} />}
      onDelete={() => usager && deleteMutation.mutate({ id: usager.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="l'usager"
      deleteLabel={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      tabs={[
        {
          value: "identite",
          label: "Élève",
          content: usager ? <TabIdentite usager={usager} /> : null,
        },
        {
          value: "adresses",
          label: "Adresses & Représentants",
          content: usager ? <TabAdresses usagerId={usager.id} /> : null,
        },
        {
          value: "circuits",
          label: "Circuits",
          content: usager ? <TabCircuits usagerId={usager.id} usager={usager} /> : null,
        },
        {
          value: "avenants",
          label: "Avenants",
          content: usager ? <TabAvenants usagerId={usager.id} /> : null,
        },
      ]}
    />
  );
}

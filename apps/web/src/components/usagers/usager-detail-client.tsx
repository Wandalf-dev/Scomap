"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabIdentite } from "./tab-identite";
import { TabAdresses } from "./tab-adresses";
import { TabCircuits } from "./tab-circuits";

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
        toast.success("Usager supprime");
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
      badges={
        usager?.gender && (
          <Badge variant="secondary">
            {usager.gender === "M" ? "Masculin" : "Feminin"}
          </Badge>
        )
      }
      onDelete={() => usager && deleteMutation.mutate({ id: usager.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="l'usager"
      deleteLabel={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      tabs={[
        {
          value: "identite",
          label: "Identite",
          content: usager ? <TabIdentite usager={usager} /> : null,
        },
        {
          value: "adresses",
          label: "Adresses",
          content: usager ? <TabAdresses usagerId={usager.id} /> : null,
        },
        {
          value: "circuits",
          label: "Circuits",
          content: usager ? <TabCircuits usagerId={usager.id} /> : null,
        },
      ]}
    />
  );
}

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
import { USAGER_STATUS_LABELS, USAGER_REGIME_LABELS } from "@/lib/validators/usager";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  brouillon: "outline",
  en_attente: "secondary",
  actif: "default",
  suspendu: "secondary",
  refuse: "destructive",
  archive: "outline",
};

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
      badges={
        usager && (
          <div className="flex gap-2">
            <Badge variant={STATUS_VARIANTS[usager.status] ?? "outline"}>
              {USAGER_STATUS_LABELS[usager.status as keyof typeof USAGER_STATUS_LABELS] ?? usager.status}
            </Badge>
            {usager.gender && (
              <Badge variant="secondary">
                {usager.gender === "M" ? "Masculin" : "Féminin"}
              </Badge>
            )}
            {usager.regime && (
              <Badge variant="secondary">
                {USAGER_REGIME_LABELS[usager.regime as keyof typeof USAGER_REGIME_LABELS] ?? usager.regime}
              </Badge>
            )}
          </div>
        )
      }
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
          content: usager ? <TabCircuits usagerId={usager.id} /> : null,
        },
      ]}
    />
  );
}

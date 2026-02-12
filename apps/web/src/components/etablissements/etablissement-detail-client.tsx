"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabCoordonnees } from "./tab-coordonnees";
import { TabHoraires } from "./tab-horaires";
import { TabInterlocuteurs } from "./tab-interlocuteurs";

const TYPE_LABELS: Record<string, string> = {
  ecole: "Ecole",
  college: "College",
  lycee: "Lycee",
  autre: "Autre",
};

interface EtablissementDetailClientProps {
  id: string;
}

export function EtablissementDetailClient({ id }: EtablissementDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: etablissement, isLoading } = useQuery(
    trpc.etablissements.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.etablissements.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Etablissement supprime");
        router.push("/etablissements");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={etablissement}
      backHref="/etablissements"
      entityName="Etablissement"
      title={etablissement?.name ?? ""}
      badges={
        etablissement?.type && (
          <Badge variant="secondary">
            {TYPE_LABELS[etablissement.type] ?? etablissement.type}
          </Badge>
        )
      }
      onDelete={() => etablissement && deleteMutation.mutate({ id: etablissement.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="l'etablissement"
      deleteLabel={etablissement?.name ?? ""}
      tabs={[
        {
          value: "coordonnees",
          label: "Coordonnees",
          content: etablissement ? <TabCoordonnees etablissement={etablissement} /> : null,
        },
        {
          value: "horaires",
          label: "Horaires",
          content: etablissement ? <TabHoraires etablissement={etablissement} /> : null,
        },
        {
          value: "interlocuteurs",
          label: "Interlocuteurs",
          content: etablissement ? <TabInterlocuteurs etablissementId={etablissement.id} /> : null,
        },
      ]}
    />
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabInformations } from "./tab-informations";
import { TabDocuments } from "./tab-documents";

interface ChauffeurDetailClientProps {
  id: string;
}

export function ChauffeurDetailClient({ id }: ChauffeurDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: chauffeur, isLoading } = useQuery(
    trpc.chauffeurs.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.chauffeurs.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur supprime");
        router.push("/chauffeurs");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={chauffeur}
      backHref="/chauffeurs"
      entityName="Chauffeur"
      title={chauffeur ? `${chauffeur.firstName} ${chauffeur.lastName}` : ""}
      badges={
        chauffeur && (
          <Badge
            variant={chauffeur.isActive ? "default" : "secondary"}
            className={
              chauffeur.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : ""
            }
          >
            {chauffeur.isActive ? "Actif" : "Inactif"}
          </Badge>
        )
      }
      onDelete={() => chauffeur && deleteMutation.mutate({ id: chauffeur.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le chauffeur"
      deleteLabel={chauffeur ? `${chauffeur.firstName} ${chauffeur.lastName}` : ""}
      tabs={[
        {
          value: "informations",
          label: "Informations",
          content: chauffeur ? <TabInformations chauffeur={chauffeur} /> : null,
        },
        {
          value: "documents",
          label: "Documents",
          content: chauffeur ? <TabDocuments chauffeur={chauffeur} /> : null,
        },
      ]}
    />
  );
}

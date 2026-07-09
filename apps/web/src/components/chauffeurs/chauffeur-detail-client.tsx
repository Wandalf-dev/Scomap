"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { ChauffeurStatusBadge } from "./chauffeur-status-badge";
import { TabInformations } from "./tab-informations";
import { TabDocuments } from "./tab-documents";

interface ChauffeurDetailClientProps {
  id: string;
  initialTab?: string;
}

export function ChauffeurDetailClient({ id, initialTab }: ChauffeurDetailClientProps) {
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
        toast.success("Chauffeur supprimé");
        router.push("/chauffeurs");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
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
        chauffeur && <ChauffeurStatusBadge isActive={chauffeur.isActive} />
      }
      onDelete={() => chauffeur && deleteMutation.mutate({ id: chauffeur.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le chauffeur"
      deleteLabel={chauffeur ? `${chauffeur.firstName} ${chauffeur.lastName}` : ""}
      defaultTab={initialTab}
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

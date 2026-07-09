"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { VehiculeStatusBadge } from "./vehicule-status-badge";
import { TabInformations } from "./tab-informations";
import { TabMaintenance } from "./tab-maintenance";

interface VehiculeDetailClientProps {
  id: string;
  initialTab?: string;
}

export function VehiculeDetailClient({ id, initialTab }: VehiculeDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: vehicule, isLoading } = useQuery(
    trpc.vehicules.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.vehicules.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Véhicule supprimé");
        router.push("/vehicules");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={vehicule}
      backHref="/vehicules"
      entityName="Véhicule"
      title={vehicule?.name ?? ""}
      badges={
        vehicule && <VehiculeStatusBadge isActive={vehicule.isActive} />
      }
      onDelete={() => vehicule && deleteMutation.mutate({ id: vehicule.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le véhicule"
      deleteLabel={vehicule?.name ?? ""}
      defaultTab={initialTab}
      tabs={[
        {
          value: "informations",
          label: "Informations",
          content: vehicule ? <TabInformations vehicule={vehicule} /> : null,
        },
        {
          value: "maintenance",
          label: "Maintenance",
          content: vehicule ? <TabMaintenance vehicule={vehicule} /> : null,
        },
      ]}
    />
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabInformations } from "./tab-informations";
import { TabMaintenance } from "./tab-maintenance";

interface VehiculeDetailClientProps {
  id: string;
}

export function VehiculeDetailClient({ id }: VehiculeDetailClientProps) {
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
        toast.success("Vehicule supprime");
        router.push("/vehicules");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={vehicule}
      backHref="/vehicules"
      entityName="Vehicule"
      title={vehicule?.name ?? ""}
      badges={
        vehicule && (
          <Badge
            variant={vehicule.isActive ? "default" : "secondary"}
            className={
              vehicule.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : ""
            }
          >
            {vehicule.isActive ? "Actif" : "Inactif"}
          </Badge>
        )
      }
      onDelete={() => vehicule && deleteMutation.mutate({ id: vehicule.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le vehicule"
      deleteLabel={vehicule?.name ?? ""}
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

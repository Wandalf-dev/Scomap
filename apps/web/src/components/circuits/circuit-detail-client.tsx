"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabInformations } from "./tab-informations";
import { TabTrajets } from "./tab-trajets";
import { TabUsagers } from "./tab-usagers";

interface CircuitDetailClientProps {
  id: string;
}

export function CircuitDetailClient({ id }: CircuitDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: circuit, isLoading } = useQuery(
    trpc.circuits.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprime");
        router.push("/circuits");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={circuit}
      backHref="/circuits"
      entityName="Circuit"
      title={circuit?.name ?? ""}
      badges={
        circuit && (
          <Badge
            variant={circuit.isActive ? "default" : "secondary"}
            className={
              circuit.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : ""
            }
          >
            {circuit.isActive ? "Actif" : "Inactif"}
          </Badge>
        )
      }
      onDelete={() => circuit && deleteMutation.mutate({ id: circuit.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le circuit"
      deleteLabel={circuit?.name ?? ""}
      tabs={[
        {
          value: "informations",
          label: "Informations",
          content: circuit ? <TabInformations circuit={circuit} /> : null,
        },
        {
          value: "trajets",
          label: "Trajets",
          content: circuit ? <TabTrajets circuitId={circuit.id} /> : null,
        },
        {
          value: "usagers",
          label: "Usagers",
          content: circuit ? <TabUsagers circuitId={circuit.id} /> : null,
        },
      ]}
    />
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabInformations } from "./tab-informations";
import { TabArrets } from "./tab-arrets";
import { TabOccurrences } from "./tab-occurrences";

interface TrajetDetailClientProps {
  id: string;
}

export function TrajetDetailClient({ id }: TrajetDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: trajet, isLoading } = useQuery(
    trpc.trajets.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.trajets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet supprime");
        router.push("/trajets");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={trajet}
      backHref="/trajets"
      entityName="Trajet"
      title={trajet?.name ?? ""}
      badges={
        trajet && (
          <Badge
            variant="outline"
            className={
              trajet.direction === "aller"
                ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                : "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
            }
          >
            {trajet.direction === "aller" ? "Aller" : "Retour"}
          </Badge>
        )
      }
      onDelete={() => trajet && deleteMutation.mutate({ id: trajet.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le trajet"
      deleteLabel={trajet?.name ?? ""}
      tabs={[
        {
          value: "informations",
          label: "Informations",
          content: trajet ? (
            <TabInformations
              trajet={{
                id: trajet.id,
                name: trajet.name,
                direction: trajet.direction,
                departureTime: trajet.departureTime,
                recurrence: trajet.recurrence as {
                  frequency: string;
                  daysOfWeek: number[];
                } | null,
                startDate: trajet.startDate,
                endDate: trajet.endDate,
                notes: trajet.notes,
                circuitId: trajet.circuitId,
                chauffeurId: trajet.chauffeurId,
                vehiculeId: trajet.vehiculeId,
              }}
            />
          ) : null,
        },
        {
          value: "arrets",
          label: "Arrets",
          content: trajet ? <TabArrets trajetId={trajet.id} /> : null,
        },
        {
          value: "occurrences",
          label: "Occurrences",
          content: trajet ? <TabOccurrences trajetId={trajet.id} /> : null,
        },
      ]}
    />
  );
}

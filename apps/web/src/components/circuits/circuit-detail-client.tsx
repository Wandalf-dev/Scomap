"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore } from "lucide-react";
import { ArchiveBoxIcon } from "@/components/ui/archive-box-icon";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { PrepaBanner } from "@/components/preparation/prepa-banner";
import { CircuitStatusBadge } from "./circuit-status-badge";
import { TabInformations } from "./tab-informations";
import { TabTrajets } from "./tab-trajets";
import { TabUsagers } from "./tab-usagers";
import { TabAvenantsCircuit } from "./tab-avenants";

interface CircuitDetailClientProps {
  id: string;
  initialTab?: string;
  /** Destination of the "Back" button (and after deletion). Default: production list. */
  backHref?: string;
  /** Detail page displayed in the context of a new-year preparation. */
  isPreparation?: boolean;
}

export function CircuitDetailClient({
  id,
  initialTab,
  backHref = "/circuits",
  isPreparation = false,
}: CircuitDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: circuit, isLoading } = useQuery(
    trpc.circuits.getById.queryOptions({ id }),
  );

  const { data: campaign } = useQuery({
    ...trpc.preparation.getCurrentCampaign.queryOptions(),
    enabled: isPreparation,
  });

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprimé");
        router.push(backHref);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const archiveMutation = useMutation(
    trpc.circuits.setArchived.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey({ id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success(variables.archived ? "Circuit archivé" : "Circuit désarchivé");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'archivage");
      },
    }),
  );

  const isArchived = !!circuit?.archivedAt;

  return (
    <>
      {isPreparation && (
        <PrepaBanner
          fullBleed
          label={campaign?.label}
          note="les modifications n'affectent pas le circuit sur l'année en cours"
        />
      )}
    <EntityDetailLayout
      isLoading={isLoading}
      entity={circuit}
      backHref={backHref}
      entityName="Circuit"
      title={circuit?.name ?? ""}
      badges={
        circuit && (
          <span className="flex items-center gap-2">
            <CircuitStatusBadge status={circuit.status} />
            {isArchived && (
              <Badge variant="secondary" className="gap-1">
                <Archive className="size-3" />
                Archivé
              </Badge>
            )}
          </span>
        )
      }
      menuActions={
        circuit
          ? [
              {
                label: isArchived ? "Désarchiver" : "Archiver",
                icon: isArchived ? ArchiveRestore : ArchiveBoxIcon,
                disabled: archiveMutation.isPending,
                onClick: () =>
                  archiveMutation.mutate({ id: circuit.id, archived: !isArchived }),
              },
            ]
          : undefined
      }
      onDelete={() => circuit && deleteMutation.mutate({ id: circuit.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le circuit"
      deleteLabel={circuit?.name ?? ""}
      defaultTab={initialTab}
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
        {
          value: "avenants",
          label: "Avenants",
          content: circuit ? <TabAvenantsCircuit circuitId={circuit.id} /> : null,
        },
      ]}
    />
    </>
  );
}

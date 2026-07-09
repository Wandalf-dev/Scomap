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
import { TabIdentite } from "./tab-identite";
import { TabAdresses } from "./tab-adresses";
import { TabCircuits } from "./tab-circuits";
import { TabAvenants } from "./tab-avenants";
import { UsagerStatusBadge } from "./usager-status-badge";

interface UsagerDetailClientProps {
  id: string;
  initialTab?: string;
  /** Destination of the "Retour" button (and after deletion). Default: production list. */
  backHref?: string;
  /** Detail page shown in the context of a school year preparation. */
  isPreparation?: boolean;
}

export function UsagerDetailClient({
  id,
  initialTab,
  backHref,
  isPreparation = false,
}: UsagerDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Contextual back link (?back= param) restricted to an internal path (anti open-redirect).
  const safeBack =
    backHref && backHref.startsWith("/") && !backHref.startsWith("//")
      ? backHref
      : "/usagers";

  const { data: usager, isLoading } = useQuery(
    trpc.usagers.getById.queryOptions({ id }),
  );

  const { data: campaign } = useQuery({
    ...trpc.preparation.getCurrentCampaign.queryOptions(),
    enabled: isPreparation,
  });

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprimé");
        router.push(safeBack);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const archiveMutation = useMutation(
    trpc.usagers.setArchived.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.getById.queryKey({ id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(variables.archived ? "Usager archivé" : "Usager désarchivé");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'archivage");
      },
    }),
  );

  const isArchived = !!usager?.archivedAt;

  return (
    <>
      {isPreparation && (
        <PrepaBanner
          fullBleed
          label={campaign?.label}
          note="les modifications n'affectent pas l'usager sur l'année en cours"
        />
      )}
    <EntityDetailLayout
      isLoading={isLoading}
      entity={usager}
      backHref={safeBack}
      entityName="Usager"
      title={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      badges={
        usager && (
          <span className="flex items-center gap-2">
            <UsagerStatusBadge status={usager.status} />
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
        usager
          ? [
              {
                label: isArchived ? "Désarchiver" : "Archiver",
                icon: isArchived ? ArchiveRestore : ArchiveBoxIcon,
                disabled: archiveMutation.isPending,
                onClick: () =>
                  archiveMutation.mutate({ id: usager.id, archived: !isArchived }),
              },
            ]
          : undefined
      }
      onDelete={() => usager && deleteMutation.mutate({ id: usager.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="l'usager"
      deleteLabel={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      defaultTab={initialTab}
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
          content: usager ? <TabCircuits usagerId={usager.id} usager={usager} /> : null,
        },
        // No avenants in school year preparation: the upcoming year is not modified via avenant.
        ...(isPreparation
          ? []
          : [
              {
                value: "avenants",
                label: "Avenants",
                content: usager ? <TabAvenants usagerId={usager.id} /> : null,
              },
            ]),
      ]}
    />
    </>
  );
}

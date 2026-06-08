"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";
import {
  ArchiveBoxIcon,
  type ArchiveBoxIconHandle,
} from "@/components/ui/archive-box-icon";
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
  /** Destination du bouton « Retour » (et après suppression). Défaut : liste prod. */
  backHref?: string;
  /** Fiche affichée dans le contexte d'une préparation de rentrée. */
  isPreparation?: boolean;
}

export function UsagerDetailClient({
  id,
  initialTab,
  backHref = "/usagers",
  isPreparation = false,
}: UsagerDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const archiveIconRef = useRef<ArchiveBoxIconHandle>(null);

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
        router.push(backHref);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
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
      onError: () => {
        toast.error("Erreur lors de l'archivage");
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
      backHref={backHref}
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
      headerExtra={
        usager && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              archiveMutation.mutate({ id: usager.id, archived: !isArchived })
            }
            onMouseEnter={() => archiveIconRef.current?.startAnimation()}
            onMouseLeave={() => archiveIconRef.current?.stopAnimation()}
            disabled={archiveMutation.isPending}
            className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="size-4" />
                Désarchiver
              </>
            ) : (
              <>
                <ArchiveBoxIcon ref={archiveIconRef} size={16} />
                Archiver
              </>
            )}
          </Button>
        )
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
        // Pas d'avenants en préparation de rentrée : on ne modifie pas l'année à venir via avenant.
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

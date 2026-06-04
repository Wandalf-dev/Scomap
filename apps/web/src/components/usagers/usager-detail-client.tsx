"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { TabIdentite } from "./tab-identite";
import { TabAdresses } from "./tab-adresses";
import { TabCircuits } from "./tab-circuits";
import { TabAvenants } from "./tab-avenants";
import { USAGER_STATUS_LABELS, USAGER_REGIME_LABELS } from "@/lib/validators/usager";

const STATUS_STYLES: Record<string, { dot: string; className: string }> = {
  brouillon: {
    dot: "bg-slate-400",
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  },
  en_attente: {
    dot: "bg-amber-500",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  },
  actif: {
    dot: "bg-emerald-500",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  suspendu: {
    dot: "bg-orange-500",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
  },
  refuse: {
    dot: "bg-red-500",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  },
  archive: {
    dot: "bg-slate-400",
    className:
      "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400",
  },
};

function UsagerStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.brouillon;
  const label =
    USAGER_STATUS_LABELS[status as keyof typeof USAGER_STATUS_LABELS] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[0.5rem] border px-2.5 py-1 text-xs font-medium",
        style.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {label}
    </span>
  );
}

interface UsagerDetailClientProps {
  id: string;
}

export function UsagerDetailClient({ id }: UsagerDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: usager, isLoading } = useQuery(
    trpc.usagers.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprimé");
        router.push("/usagers");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={usager}
      backHref="/usagers"
      entityName="Usager"
      title={usager ? `${usager.firstName} ${usager.lastName}` : ""}
      badges={
        usager && (
          <div className="flex shrink-0 items-center gap-2">
            <UsagerStatusBadge status={usager.status} />
            {usager.regime && (
              <span className="inline-flex items-center rounded-[0.5rem] border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {USAGER_REGIME_LABELS[usager.regime as keyof typeof USAGER_REGIME_LABELS] ?? usager.regime}
              </span>
            )}
          </div>
        )
      }
      onDelete={() => usager && deleteMutation.mutate({ id: usager.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="l'usager"
      deleteLabel={usager ? `${usager.firstName} ${usager.lastName}` : ""}
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
        {
          value: "avenants",
          label: "Avenants",
          content: usager ? <TabAvenants usagerId={usager.id} /> : null,
        },
      ]}
    />
  );
}

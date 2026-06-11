"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  Pencil,
  Trash2,
  ExternalLink,
  Archive,
  ArchiveRestore,
  CalendarDays,
  Copy,
} from "lucide-react";
import { ShareIcon } from "@/components/ui/share-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { CircuitFormDialog } from "./circuit-form-dialog";
import { CircuitStatusBadge } from "./circuit-status-badge";
import {
  CIRCUIT_STATUSES,
  CIRCUIT_STATUS_LABELS,
  type CircuitFormValues,
} from "@/lib/validators/circuit";

interface CircuitRow {
  id: string;
  displayId: number;
  name: string;
  code: string | null;
  status: string;
  archivedAt: Date | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  etablissementId: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  trajetCount: number;
  totalKm: number;
  avenantCount: number;
}

function formatCircuitDate(d: string | null): string {
  if (!d) return "…";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type CircuitFilters = {
  displayId: string;
  code: string;
  name: string;
  status: string;
  etablissement: string;
  periode: string;
};

const EMPTY_FILTERS: CircuitFilters = {
  displayId: "",
  code: "",
  name: "",
  status: "all",
  etablissement: "",
  periode: "",
};

export function CircuitsClient({ campaignId }: { campaignId?: string } = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  // Mode préparation : la liste est scopée à une campagne (sinon production).
  const isPrepa = !!campaignId;
  const detailBase = isPrepa ? "/preparation/circuits" : "/circuits";

  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<CircuitRow | null>(null);
  // Dialog « Modifier les dates » (action groupée).
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [datesIds, setDatesIds] = useState<string[]>([]);
  const [datesStart, setDatesStart] = useState<string | null>(null);
  const [datesEnd, setDatesEnd] = useState<string | null>(null);

  const { data: circuitsList, isLoading, error } = useQuery(
    trpc.circuits.list.queryOptions(campaignId ? { campaignId } : undefined),
  );

  // Campagne de préparation en cours (pour l'action « Copier en préparation »
  // depuis la production).
  const { data: currentCampaign } = useQuery({
    ...trpc.preparation.getCurrentCampaign.queryOptions(),
    enabled: !isPrepa,
  });

  const copyToPrepaMutation = useMutation(
    trpc.preparation.copyCircuits.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `${data.copied} circuit${data.copied > 1 ? "s" : ""} copié${data.copied > 1 ? "s" : ""} en préparation`,
        );
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la copie en préparation"),
    }),
  );

  const currentCircuits = circuitsList?.filter((c) => !c.archivedAt) ?? [];
  const archivedCircuits = circuitsList?.filter((c) => !!c.archivedAt) ?? [];
  const displayedCircuits =
    activeTab === "current" ? currentCircuits : archivedCircuits;

  const createMutation = useMutation(
    trpc.circuits.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit créé avec succès");
        setFormOpen(false);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.circuits.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit modifié avec succès");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprimé");
        setDeleteItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const deleteManyMutation = useMutation(
    trpc.circuits.deleteMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success(`${data.deleted} élément${data.deleted > 1 ? "s" : ""} supprimé${data.deleted > 1 ? "s" : ""}`);
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
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success(variables.archived ? "Circuit archivé" : "Circuit désarchivé");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'archivage");
      },
    }),
  );

  const archiveManyMutation = useMutation(
    trpc.circuits.setArchivedMany.mutationOptions({
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success(
          `${data.updated} circuit${data.updated > 1 ? "s" : ""} ${
            variables.archived ? "archivé" : "désarchivé"
          }${data.updated > 1 ? "s" : ""}`,
        );
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'archivage");
      },
    }),
  );

  const updateDatesManyMutation = useMutation(
    trpc.circuits.updateDatesMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        const skippedNote =
          data.skipped > 0
            ? `${data.skipped} circuit${data.skipped > 1 ? "s" : ""} ignoré${data.skipped > 1 ? "s" : ""} : dates figées car ${data.skipped > 1 ? "ils ont" : "il a"} des usagers.`
            : undefined;
        if (data.updated === 0 && data.skipped > 0) {
          // Tous les circuits sélectionnés sont verrouillés : aucune mise à jour.
          toast.warning("Aucune date modifiée", { description: skippedNote });
        } else {
          toast.success(
            `Dates mises à jour (${data.updated} circuit${data.updated > 1 ? "s" : ""})`,
            skippedNote ? { description: skippedNote } : undefined,
          );
        }
        setDatesDialogOpen(false);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la mise à jour des dates");
      },
    }),
  );

  function handleFormSubmit(values: CircuitFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    }
  }

  return (
    <div className="space-y-4">
      {!isPrepa && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "archived")}>
          <TabsList>
            <TabsTrigger value="current" className="cursor-pointer">
              Courants
              {!isLoading && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
                  {currentCircuits.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="cursor-pointer">
              Archivés
              {!isLoading && archivedCircuits.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
                  {archivedCircuits.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

    <DataList<CircuitRow, CircuitFilters>
      data={displayedCircuits}
      isLoading={isLoading}
      error={error}
      onBulkDelete={(ids) => deleteManyMutation.mutate({ ids })}
      isBulkDeleting={deleteManyMutation.isPending}
      bulkActions={[
        ...(isPrepa
          ? []
          : [
              activeTab === "archived"
                ? {
                    label: "Désarchiver les circuits",
                    icon: ArchiveRestore,
                    onClick: (ids: string[]) =>
                      archiveManyMutation.mutate({ ids, archived: false }),
                  }
                : {
                    label: "Archiver les circuits",
                    icon: Archive,
                    onClick: (ids: string[]) =>
                      archiveManyMutation.mutate({ ids, archived: true }),
                  },
            ]),
        {
          label: "Modifier les dates",
          icon: CalendarDays,
          onClick: (ids: string[]) => {
            setDatesIds(ids);
            setDatesStart(null);
            setDatesEnd(null);
            setDatesDialogOpen(true);
          },
        },
        ...(!isPrepa
          ? [
              {
                label: "Copier en préparation",
                icon: Copy,
                onClick: (ids: string[]) => {
                  if (currentCampaign) {
                    copyToPrepaMutation.mutate({
                      campaignId: currentCampaign.id,
                      circuitIds: ids,
                    });
                  } else {
                    toast.info(
                      "Aucune préparation en cours — démarrez-en une d'abord.",
                    );
                    router.push("/preparation");
                  }
                },
              },
            ]
          : []),
      ]}
      title="Circuits"
      description="Gérez vos circuits de transport"
      emptyIcon={ShareIcon}
      emptyTitle={
        activeTab === "archived" ? "Aucun circuit archivé" : "Aucun circuit"
      }
      emptyDescription={
        activeTab === "archived"
          ? "Les circuits archivés apparaîtront ici."
          : "Commencez par ajouter votre premier circuit."
      }
      addButtonLabel={
        isPrepa || activeTab === "archived" ? undefined : "Ajouter un circuit"
      }
      addHref={isPrepa || activeTab === "archived" ? undefined : "/circuits/new"}
      columns={[
        {
          key: "displayId",
          header: "N°",
          render: (row) => (
            <span className="tabular-nums text-muted-foreground">
              {row.displayId}
            </span>
          ),
        },
        {
          key: "code",
          header: "Code",
          render: (row) =>
            row.code ? (
              <span className="font-medium tabular-nums text-foreground">
                {row.code}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "name",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.name}</span>
          ),
        },
        {
          key: "status",
          header: "Statut",
          render: (row) => <CircuitStatusBadge status={row.status} />,
          exportValue: (row) =>
            CIRCUIT_STATUS_LABELS[
              row.status as (typeof CIRCUIT_STATUSES)[number]
            ] ?? row.status,
        },
        {
          key: "etablissement",
          header: "Établissement",
          exportValue: (row) =>
            row.etablissementName
              ? row.etablissementCity
                ? `${row.etablissementName} (${row.etablissementCity})`
                : row.etablissementName
              : null,
          render: (row) =>
            row.etablissementName ? (
              <span className="text-foreground">
                {row.etablissementName}
                {row.etablissementCity && (
                  <span className="ml-1 text-muted-foreground">
                    ({row.etablissementCity})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "periode",
          header: "Période",
          exportValue: (row) =>
            row.startDate || row.endDate
              ? `${formatCircuitDate(row.startDate)} → ${formatCircuitDate(row.endDate)}`
              : null,
          render: (row) =>
            row.startDate || row.endDate ? (
              <span className="whitespace-nowrap text-sm tabular-nums">
                {formatCircuitDate(row.startDate)} &rarr;{" "}
                {formatCircuitDate(row.endDate)}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "trajets",
          header: "Trajets",
          exportValue: (row) => row.trajetCount,
          render: (row) => (
            <span className="tabular-nums text-foreground">
              {row.trajetCount}
            </span>
          ),
        },
        {
          key: "km",
          header: "Km",
          exportValue: (row) => (row.totalKm > 0 ? row.totalKm : null),
          render: (row) =>
            row.totalKm > 0 ? (
              <span className="tabular-nums text-foreground">
                {row.totalKm.toFixed(1).replace(".", ",")}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "avenants",
          header: "Avenants",
          exportValue: (row) => row.avenantCount,
          render: (row) =>
            row.avenantCount > 0 ? (
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
              >
                {row.avenantCount}
              </Badge>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`${detailBase}/${row.id}`)}
      filters={[
        { key: "displayId", label: "N°", type: "text" },
        { key: "code", label: "Code", type: "text" },
        { key: "name", label: "Nom", type: "text" },
        {
          key: "status",
          label: "Statut",
          type: "select",
          options: [
            { value: "all", label: "Tous les statuts" },
            ...CIRCUIT_STATUSES.map((s) => ({
              value: s,
              label: CIRCUIT_STATUS_LABELS[s],
            })),
          ],
        },
        { key: "etablissement", label: "Établissement", type: "text" },
        { key: "periode", label: "Période", type: "daterange" },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.displayId && !String(row.displayId).includes(filters.displayId.trim()))
          return false;
        if (
          filters.code &&
          !(row.code ?? "").toLowerCase().includes(filters.code.toLowerCase())
        )
          return false;
        if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase()))
          return false;
        if (filters.status !== "all" && row.status !== filters.status) return false;
        if (filters.etablissement) {
          const haystack = `${row.etablissementName ?? ""} ${row.etablissementCity ?? ""}`.toLowerCase();
          if (!haystack.includes(filters.etablissement.toLowerCase())) return false;
        }
        if (filters.periode) {
          // Plage "from|to" (ISO, bornes optionnelles). On garde les circuits
          // dont la période CHEVAUCHE l'intervalle saisi. Bornes nulles =
          // ouvertes. Comparaison lexicographique ISO = ordre chronologique.
          const [from = "", to = ""] = filters.periode.split("|");
          // chevauchement : circuit.start <= to ET circuit.end >= from
          if (to && row.startDate && row.startDate > to) return false;
          if (from && row.endDate && row.endDate < from) return false;
        }
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`${detailBase}/${row.id}`),
        },
        {
          label: "Modifier rapidement",
          icon: Pencil,
          onClick: (row) => {
            setEditingItem(row);
            setFormMode("edit");
            setFormOpen(true);
          },
        },
        activeTab === "archived"
          ? {
              label: "Désarchiver",
              icon: ArchiveRestore,
              onClick: (row) =>
                archiveMutation.mutate({ id: row.id, archived: false }),
            }
          : {
              label: "Archiver",
              icon: Archive,
              onClick: (row) =>
                archiveMutation.mutate({ id: row.id, archived: true }),
            },
        {
          label: "Supprimer",
          icon: Trash2,
          variant: "destructive",
          separator: true,
          onClick: (row) => setDeleteItem(row),
        },
      ]}
    >
      <CircuitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? { name: editingItem.name, etablissementId: editingItem.etablissementId }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      <EntityDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate({ id: deleteItem.id })}
        entityName="le circuit"
        entityLabel={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />

      <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              Modifier les dates ({datesIds.length} circuit
              {datesIds.length > 1 ? "s" : ""})
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Date de début</span>
              <DatePicker value={datesStart} onChange={setDatesStart} clearable />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Date de fin</span>
              <DatePicker value={datesEnd} onChange={setDatesEnd} clearable />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Les dates seront appliquées à tous les circuits sélectionnés. Un
            champ laissé vide efface la date correspondante.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDatesDialogOpen(false)}
              disabled={updateDatesManyMutation.isPending}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              onClick={() =>
                updateDatesManyMutation.mutate({
                  ids: datesIds,
                  startDate: datesStart,
                  endDate: datesEnd,
                })
              }
              disabled={updateDatesManyMutation.isPending}
              className="cursor-pointer"
            >
              {updateDatesManyMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataList>
    </div>
  );
}

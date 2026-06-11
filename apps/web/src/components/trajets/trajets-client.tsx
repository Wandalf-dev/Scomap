"use client";

import { useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { ArrowPathRoundedSquareIcon } from "@/components/ui/arrow-path-rounded-square-icon";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { TrajetFormDialog } from "./trajet-form-dialog";
import { DayBadges } from "@/components/shared/day-badges";
import { formatDaysShort } from "@/lib/types/day-entry";
import type { TrajetFormValues } from "@/lib/validators/trajet";
import type { DayEntry } from "@/lib/types/day-entry";

interface TrajetRow {
  id: string;
  name: string;
  direction: string;
  departureTime: string | null;
  recurrence: { frequency: string; daysOfWeek: DayEntry[] } | null;
  etat: string | null;
  totalDistanceKm: number | null;
  circuitId: string;
  circuitName: string | null;
  chauffeurId: string | null;
  chauffeurFirstName: string | null;
  chauffeurLastName: string | null;
  vehiculeId: string | null;
  vehiculeName: string | null;
}

type TrajetFilters = {
  name: string;
  direction: string;
  etat: string;
  circuit: string;
  chauffeur: string;
  vehicule: string;
};

const EMPTY_FILTERS: TrajetFilters = {
  name: "",
  direction: "all",
  etat: "all",
  circuit: "all",
  chauffeur: "all",
  vehicule: "all",
};

// Valeur sentinelle pour filtrer les trajets sans chauffeur / sans véhicule.
const UNASSIGNED = "__none__";

export function TrajetsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<TrajetRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<TrajetRow | null>(null);

  const { data: trajetsList, isLoading, error } = useQuery(
    trpc.trajets.list.queryOptions(),
  );

  // Options des selects dérivées des données affichées (circuits/chauffeurs/
  // véhicules réellement présents), triées par libellé.
  const { circuitOptions, chauffeurOptions, vehiculeOptions } = useMemo(() => {
    const circuits = new Map<string, string>();
    const chauffeurs = new Map<string, string>();
    const vehicules = new Map<string, string>();
    let hasUnassignedChauffeur = false;
    let hasUnassignedVehicule = false;

    for (const t of trajetsList ?? []) {
      if (t.circuitId && t.circuitName) circuits.set(t.circuitId, t.circuitName);
      if (t.chauffeurId) {
        chauffeurs.set(
          t.chauffeurId,
          `${t.chauffeurFirstName ?? ""} ${t.chauffeurLastName ?? ""}`.trim(),
        );
      } else {
        hasUnassignedChauffeur = true;
      }
      if (t.vehiculeId && t.vehiculeName) vehicules.set(t.vehiculeId, t.vehiculeName);
      else if (!t.vehiculeId) hasUnassignedVehicule = true;
    }

    const sortByLabel = (a: { label: string }, b: { label: string }) =>
      a.label.localeCompare(b.label, "fr");

    return {
      circuitOptions: [
        { value: "all", label: "Tous" },
        ...[...circuits].map(([value, label]) => ({ value, label })).sort(sortByLabel),
      ],
      chauffeurOptions: [
        { value: "all", label: "Tous" },
        ...(hasUnassignedChauffeur ? [{ value: UNASSIGNED, label: "Non assigné" }] : []),
        ...[...chauffeurs].map(([value, label]) => ({ value, label })).sort(sortByLabel),
      ],
      vehiculeOptions: [
        { value: "all", label: "Tous" },
        ...(hasUnassignedVehicule ? [{ value: UNASSIGNED, label: "Non assigné" }] : []),
        ...[...vehicules].map(([value, label]) => ({ value, label })).sort(sortByLabel),
      ],
    };
  }, [trajetsList]);

  const createMutation = useMutation(
    trpc.trajets.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet créé avec succès");
        setFormOpen(false);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.trajets.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet modifié avec succès");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.trajets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet supprimé");
        setDeleteItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const deleteManyMutation = useMutation(
    trpc.trajets.deleteMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success(`${data.deleted} élément${data.deleted > 1 ? "s" : ""} supprimé${data.deleted > 1 ? "s" : ""}`);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  function handleFormSubmit(values: TrajetFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    }
  }

  return (
    <DataList<TrajetRow, TrajetFilters>
      data={trajetsList}
      isLoading={isLoading}
      error={error}
      onBulkDelete={(ids) => deleteManyMutation.mutate({ ids })}
      isBulkDeleting={deleteManyMutation.isPending}
      title="Trajets"
      description="Gérez vos trajets de transport"
      emptyIcon={ArrowPathRoundedSquareIcon}
      emptyTitle="Aucun trajet"
      emptyDescription="Commencez par ajouter votre premier trajet."
      addButtonLabel="Ajouter un trajet"
      addHref="/trajets/new"
      columns={[
        {
          key: "name",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.name}</span>
          ),
        },
        {
          key: "circuit",
          header: "Circuit",
          exportValue: (row) => row.circuitName,
          render: (row) =>
            row.circuitName ? (
              <span className="text-muted-foreground">{row.circuitName}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "direction",
          header: "Direction",
          exportValue: (row) => (row.direction === "aller" ? "Aller" : "Retour"),
          render: (row) => (
            <Badge variant="outline">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  row.direction === "aller" ? "bg-blue-500" : "bg-purple-500"
                }`}
              />
              {row.direction === "aller" ? "Aller" : "Retour"}
            </Badge>
          ),
        },
        {
          key: "etat",
          header: "État",
          exportValue: (row) => {
            const etat = row.etat || "brouillon";
            return etat === "ok" ? "Ok" : etat === "anomalie" ? "Anomalie" : "Brouillon";
          },
          render: (row) => {
            const etat = row.etat || "brouillon";
            const dotColor =
              etat === "ok"
                ? "bg-emerald-500"
                : etat === "anomalie"
                  ? "bg-red-500"
                  : "bg-amber-500";
            const label =
              etat === "ok" ? "Ok" : etat === "anomalie" ? "Anomalie" : "Brouillon";
            return (
              <Badge variant="outline">
                <span aria-hidden="true" className={`size-1.5 rounded-full ${dotColor}`} />
                {label}
              </Badge>
            );
          },
        },
        {
          key: "chauffeur",
          header: "Chauffeur",
          exportValue: (row) =>
            row.chauffeurFirstName
              ? `${row.chauffeurFirstName} ${row.chauffeurLastName ?? ""}`.trim()
              : null,
          render: (row) =>
            row.chauffeurFirstName ? (
              <span className="text-muted-foreground">
                {row.chauffeurFirstName} {row.chauffeurLastName}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "vehicule",
          header: "Véhicule",
          exportValue: (row) => row.vehiculeName,
          render: (row) =>
            row.vehiculeName ? (
              <span className="text-muted-foreground">{row.vehiculeName}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "departure",
          header: "Horaire",
          exportValue: (row) => row.departureTime,
          render: (row) =>
            row.departureTime ? (
              <span className="font-mono text-sm">{row.departureTime}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "days",
          header: "Jours",
          exportValue: (row) =>
            row.recurrence?.daysOfWeek?.length
              ? formatDaysShort(row.recurrence.daysOfWeek)
              : null,
          render: (row) => (
            <DayBadges days={row.recurrence?.daysOfWeek ?? null} />
          ),
        },
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/trajets/${row.id}`)}
      filters={[
        { key: "name", label: "Nom", type: "text" },
        {
          key: "direction",
          label: "Direction",
          type: "select",
          options: [
            { value: "all", label: "Toutes" },
            { value: "aller", label: "Aller" },
            { value: "retour", label: "Retour" },
          ],
        },
        {
          key: "etat",
          label: "État",
          type: "select",
          options: [
            { value: "all", label: "Tous" },
            { value: "ok", label: "Ok" },
            { value: "anomalie", label: "Anomalie" },
            { value: "brouillon", label: "Brouillon" },
          ],
        },
        { key: "circuit", label: "Circuit", type: "select", options: circuitOptions },
        { key: "chauffeur", label: "Chauffeur", type: "select", options: chauffeurOptions },
        { key: "vehicule", label: "Véhicule", type: "select", options: vehiculeOptions },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (
          filters.name &&
          !row.name.toLowerCase().includes(filters.name.toLowerCase())
        )
          return false;
        if (filters.direction !== "all" && row.direction !== filters.direction)
          return false;
        if (filters.etat !== "all" && (row.etat || "brouillon") !== filters.etat)
          return false;
        if (filters.circuit !== "all" && row.circuitId !== filters.circuit)
          return false;
        if (filters.chauffeur !== "all") {
          if (filters.chauffeur === UNASSIGNED) {
            if (row.chauffeurId) return false;
          } else if (row.chauffeurId !== filters.chauffeur) {
            return false;
          }
        }
        if (filters.vehicule !== "all") {
          if (filters.vehicule === UNASSIGNED) {
            if (row.vehiculeId) return false;
          } else if (row.vehiculeId !== filters.vehicule) {
            return false;
          }
        }
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/trajets/${row.id}`),
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
        {
          label: "Supprimer",
          icon: Trash2,
          variant: "destructive",
          separator: true,
          onClick: (row) => setDeleteItem(row),
        },
      ]}
    >
      <TrajetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                name: editingItem.name,
                circuitId: editingItem.circuitId,
                direction: editingItem.direction as "aller" | "retour",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      <EntityDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() =>
          deleteItem && deleteMutation.mutate({ id: deleteItem.id })
        }
        entityName="le trajet"
        entityLabel={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </DataList>
  );
}

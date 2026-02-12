"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Navigation, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { TrajetFormDialog } from "./trajet-form-dialog";
import { DayBadges } from "@/components/shared/day-badges";
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
};

const EMPTY_FILTERS: TrajetFilters = {
  name: "",
  direction: "all",
};

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

  const createMutation = useMutation(
    trpc.trajets.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.trajets.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.trajets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
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
      title="Trajets"
      description="Gerez vos trajets de transport"
      emptyIcon={Navigation}
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
          render: (row) => (
            <Badge
              variant="outline"
              className={
                row.direction === "aller"
                  ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                  : "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
              }
            >
              {row.direction === "aller" ? "Aller" : "Retour"}
            </Badge>
          ),
        },
        {
          key: "etat",
          header: "Etat",
          render: (row) => {
            if (!row.etat || row.etat === "brouillon") {
              return (
                <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
                  Brouillon
                </Badge>
              );
            }
            if (row.etat === "ok") {
              return (
                <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                  Ok
                </Badge>
              );
            }
            return (
              <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                Anomalie
              </Badge>
            );
          },
        },
        {
          key: "chauffeur",
          header: "Chauffeur",
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
          header: "Vehicule",
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Truck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { VehiculeFormDialog } from "./vehicule-form-dialog";
import type { VehiculeFormValues } from "@/lib/validators/vehicule";

interface VehiculeRow {
  id: string;
  name: string;
  licensePlate: string | null;
  brand: string | null;
  model: string | null;
  capacity: number | null;
  isActive: boolean;
}

type VehiculeFilters = {
  name: string;
  licensePlate: string;
  status: string;
};

const EMPTY_FILTERS: VehiculeFilters = {
  name: "",
  licensePlate: "",
  status: "all",
};

export function VehiculesClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<VehiculeRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<VehiculeRow | null>(null);

  const { data: vehiculesList, isLoading, error } = useQuery(
    trpc.vehicules.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.vehicules.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.vehicules.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.vehicules.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function handleFormSubmit(values: VehiculeFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    }
  }

  return (
    <DataList<VehiculeRow, VehiculeFilters>
      data={vehiculesList}
      isLoading={isLoading}
      error={error}
      title="Vehicules"
      description="Gerez votre flotte de vehicules"
      emptyIcon={Truck}
      emptyTitle="Aucun vehicule"
      emptyDescription="Commencez par ajouter votre premier vehicule."
      addButtonLabel="Ajouter un vehicule"
      addHref="/vehicules/new"
      columns={[
        {
          key: "name",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.name}</span>
          ),
        },
        {
          key: "licensePlate",
          header: "Immatriculation",
          render: (row) =>
            row.licensePlate ? (
              <span className="text-muted-foreground">{row.licensePlate}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "brandModel",
          header: "Marque / Modele",
          render: (row) =>
            row.brand || row.model ? (
              <span className="text-muted-foreground">
                {[row.brand, row.model].filter(Boolean).join(" ")}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "capacity",
          header: "Capacite",
          render: (row) =>
            row.capacity != null ? (
              <span className="text-muted-foreground">{row.capacity}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "status",
          header: "Statut",
          render: (row) => (
            <Badge
              variant={row.isActive ? "default" : "secondary"}
              className={
                row.isActive
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : ""
              }
            >
              {row.isActive ? "Actif" : "Inactif"}
            </Badge>
          ),
        },
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/vehicules/${row.id}`)}
      filters={[
        { key: "name", label: "Nom", type: "text" },
        { key: "licensePlate", label: "Immatriculation", type: "text" },
        {
          key: "status",
          label: "Statut",
          type: "select",
          options: [
            { value: "all", label: "Tous" },
            { value: "active", label: "Actif" },
            { value: "inactive", label: "Inactif" },
          ],
        },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.licensePlate && !row.licensePlate?.toLowerCase().includes(filters.licensePlate.toLowerCase())) return false;
        if (filters.status === "active" && !row.isActive) return false;
        if (filters.status === "inactive" && row.isActive) return false;
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/vehicules/${row.id}`),
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
      <VehiculeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                name: editingItem.name,
                licensePlate: editingItem.licensePlate ?? "",
                capacity: editingItem.capacity?.toString() ?? "",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      <EntityDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate({ id: deleteItem.id })}
        entityName="le vehicule"
        entityLabel={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </DataList>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { TruckIcon } from "@/components/ui/truck-icon";
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
        toast.success("Véhicule créé avec succès");
        setFormOpen(false);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.vehicules.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Véhicule modifié avec succès");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.vehicules.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Véhicule supprimé");
        setDeleteItem(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const deleteManyMutation = useMutation(
    trpc.vehicules.deleteMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success(`${data.deleted} élément${data.deleted > 1 ? "s" : ""} supprimé${data.deleted > 1 ? "s" : ""}`);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
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
      onBulkDelete={(ids) => deleteManyMutation.mutate({ ids })}
      isBulkDeleting={deleteManyMutation.isPending}
      title="Véhicules"
      description="Gérez votre flotte de véhicules"
      emptyIcon={TruckIcon}
      emptyTitle="Aucun véhicule"
      emptyDescription="Commencez par ajouter votre premier véhicule."
      addButtonLabel="Ajouter un véhicule"
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
          header: "Marque / Modèle",
          exportValue: (row) =>
            [row.brand, row.model].filter(Boolean).join(" ") || null,
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
          header: "Capacité",
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
          exportValue: (row) => (row.isActive ? "Actif" : "Inactif"),
          render: (row) => (
            <Badge variant="outline">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  row.isActive ? "bg-emerald-500" : "bg-muted-foreground/64"
                }`}
              />
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

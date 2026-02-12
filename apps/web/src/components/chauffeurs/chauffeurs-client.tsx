"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, UserCog, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { ChauffeurFormDialog } from "./chauffeur-form-dialog";
import type { ChauffeurFormValues } from "@/lib/validators/chauffeur";

interface ChauffeurRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

type ChauffeurFilters = {
  lastName: string;
  firstName: string;
  status: string;
};

const EMPTY_FILTERS: ChauffeurFilters = {
  lastName: "",
  firstName: "",
  status: "all",
};

export function ChauffeursClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<ChauffeurRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<ChauffeurRow | null>(null);

  const { data: chauffeursList, isLoading, error } = useQuery(
    trpc.chauffeurs.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.chauffeurs.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.chauffeurs.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.chauffeurs.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function handleFormSubmit(values: ChauffeurFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    }
  }

  return (
    <DataList<ChauffeurRow, ChauffeurFilters>
      data={chauffeursList}
      isLoading={isLoading}
      error={error}
      title="Chauffeurs"
      description="Gerez vos chauffeurs"
      emptyIcon={UserCog}
      emptyTitle="Aucun chauffeur"
      emptyDescription="Commencez par ajouter votre premier chauffeur."
      addButtonLabel="Ajouter un chauffeur"
      addHref="/chauffeurs/new"
      columns={[
        {
          key: "lastName",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.lastName}</span>
          ),
        },
        {
          key: "firstName",
          header: "Prenom",
          render: (row) => (
            <span className="text-foreground">{row.firstName}</span>
          ),
        },
        {
          key: "phone",
          header: "Telephone",
          render: (row) =>
            row.phone ? (
              <span className="text-muted-foreground">{row.phone}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "email",
          header: "Email",
          render: (row) =>
            row.email ? (
              <span className="text-muted-foreground">{row.email}</span>
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
      onRowClick={(row) => router.push(`/chauffeurs/${row.id}`)}
      filters={[
        { key: "lastName", label: "Nom", type: "text" },
        { key: "firstName", label: "Prenom", type: "text" },
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
        if (filters.lastName && !row.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) return false;
        if (filters.firstName && !row.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) return false;
        if (filters.status === "active" && !row.isActive) return false;
        if (filters.status === "inactive" && row.isActive) return false;
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/chauffeurs/${row.id}`),
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
      <ChauffeurFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                firstName: editingItem.firstName,
                lastName: editingItem.lastName,
                phone: editingItem.phone ?? "",
                email: editingItem.email ?? "",
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
        entityName="le chauffeur"
        entityLabel={deleteItem ? `${deleteItem.firstName} ${deleteItem.lastName}` : ""}
        isPending={deleteMutation.isPending}
      />
    </DataList>
  );
}

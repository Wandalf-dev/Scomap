"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, School, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { EtablissementFormDialog } from "./etablissement-form-dialog";
import type { EtablissementFormValues } from "@/lib/validators/etablissement";

const TYPE_LABELS: Record<string, string> = {
  ecole: "Ecole",
  college: "College",
  lycee: "Lycee",
  autre: "Autre",
};

const TYPE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "ecole", label: "Ecole" },
  { value: "college", label: "College" },
  { value: "lycee", label: "Lycee" },
  { value: "autre", label: "Autre" },
];

interface Etablissement {
  id: string;
  name: string;
  type: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

type EtablissementFilters = {
  name: string;
  type: string;
  city: string;
  phone: string;
  email: string;
};

const EMPTY_FILTERS: EtablissementFilters = {
  name: "",
  type: "all",
  city: "",
  phone: "",
  email: "",
};

export function EtablissementsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<Etablissement | null>(null);
  const [deleteItem, setDeleteItem] = useState<Etablissement | null>(null);

  const { data: etablissements, isLoading, error } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.etablissements.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Etablissement cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.etablissements.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Etablissement modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.etablissements.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Etablissement supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function handleFormSubmit(values: EtablissementFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
    }
  }

  return (
    <DataList<Etablissement, EtablissementFilters>
      data={etablissements}
      isLoading={isLoading}
      error={error}
      title="Etablissements"
      description="Gerez les etablissements scolaires"
      emptyIcon={School}
      emptyTitle="Aucun etablissement"
      emptyDescription="Commencez par ajouter votre premier etablissement."
      addButtonLabel="Ajouter un etablissement"
      addHref="/etablissements/new"
      columns={[
        {
          key: "name",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.name}</span>
          ),
        },
        {
          key: "type",
          header: "Type",
          className: "w-[120px]",
          render: (row) =>
            row.type ? (
              <Badge variant="outline" className="font-normal">
                {TYPE_LABELS[row.type] ?? row.type}
              </Badge>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "city",
          header: "Ville",
          render: (row) =>
            row.city ? (
              <span className="text-muted-foreground">{row.city}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
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
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/etablissements/${row.id}`)}
      filters={[
        { key: "name", label: "Nom", type: "text", className: "h-8 w-44 text-sm" },
        {
          key: "type",
          label: "Type",
          type: "select",
          className: "h-8 w-40 cursor-pointer text-sm",
          options: TYPE_OPTIONS,
        },
        { key: "city", label: "Ville", type: "text" },
        { key: "phone", label: "Telephone", type: "text" },
        { key: "email", label: "Email", type: "text", className: "h-8 w-48 text-sm" },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.type !== "all" && row.type !== filters.type) return false;
        if (filters.city && !row.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
        if (filters.phone && !row.phone?.toLowerCase().includes(filters.phone.toLowerCase())) return false;
        if (filters.email && !row.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/etablissements/${row.id}`),
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
      <EtablissementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                name: editingItem.name,
                type: editingItem.type ?? "",
                address: editingItem.address,
                city: editingItem.city ?? "",
                postalCode: editingItem.postalCode ?? "",
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
        entityName="l'etablissement"
        entityLabel={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </DataList>
  );
}

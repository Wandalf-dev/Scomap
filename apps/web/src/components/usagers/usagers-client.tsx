"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Users, ExternalLink } from "lucide-react";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { UsagerFormDialog } from "./usager-form-dialog";
import type { UsagerFormValues } from "@/lib/validators/usager";

interface UsagerRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
}

type UsagerFilters = {
  lastName: string;
  firstName: string;
  etablissement: string;
  city: string;
};

const EMPTY_FILTERS: UsagerFilters = {
  lastName: "",
  firstName: "",
  etablissement: "all",
  city: "",
};

type SortColumn = "lastName" | "firstName" | "birthDate" | "etablissementName" | "etablissementCity";

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  } catch {
    return dateStr;
  }
}

export function UsagersClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<UsagerRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsagerRow | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: usagersList, isLoading, error } = useQuery(
    trpc.usagers.list.queryOptions(),
  );

  const etablissementOptions = useMemo(() => {
    if (!usagersList) return [];
    const names = new Set<string>();
    usagersList.forEach((u) => {
      if (u.etablissementName) names.add(u.etablissementName);
    });
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [usagersList]);

  const createMutation = useMutation(
    trpc.usagers.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.usagers.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function handleSort(column: string) {
    const col = column as SortColumn;
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }

  function handleFormSubmit(values: UsagerFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          birthDate: values.birthDate,
          gender: values.gender,
          etablissementId: values.etablissementId,
        },
      });
    }
  }

  return (
    <DataList<UsagerRow, UsagerFilters>
      data={usagersList}
      isLoading={isLoading}
      error={error}
      title="Usagers"
      description="Gerez les eleves transportes"
      emptyIcon={Users}
      emptyTitle="Aucun usager"
      emptyDescription="Commencez par ajouter votre premier usager."
      addButtonLabel="Ajouter un usager"
      addHref="/usagers/new"
      columns={[
        {
          key: "lastName",
          header: "Nom",
          sortable: true,
          render: (row) => (
            <span className="font-medium text-foreground">{row.lastName}</span>
          ),
        },
        {
          key: "firstName",
          header: "Prenom",
          sortable: true,
          render: (row) => (
            <span className="text-foreground">{row.firstName}</span>
          ),
        },
        {
          key: "birthDate",
          header: "Date de naissance",
          sortable: true,
          render: (row) =>
            formatDate(row.birthDate) ? (
              <span className="text-muted-foreground">{formatDate(row.birthDate)}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "etablissementName",
          header: "Etablissement",
          sortable: true,
          render: (row) =>
            row.etablissementName ? (
              <span className="text-muted-foreground">{row.etablissementName}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "etablissementCity",
          header: "Ville",
          sortable: true,
          render: (row) =>
            row.etablissementCity ? (
              <span className="text-muted-foreground">{row.etablissementCity}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/usagers/${row.id}`)}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={handleSort}
      sortFn={(a, b, column, direction) => {
        const aVal = (a[column as keyof UsagerRow] ?? "") as string;
        const bVal = (b[column as keyof UsagerRow] ?? "") as string;
        const cmp = aVal.localeCompare(bVal, "fr", { sensitivity: "base" });
        return direction === "asc" ? cmp : -cmp;
      }}
      filters={[
        { key: "lastName", label: "Nom", type: "text" },
        { key: "firstName", label: "Prenom", type: "text" },
        {
          key: "etablissement",
          label: "Etablissement",
          type: "select",
          className: "h-8 w-48 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...etablissementOptions,
          ],
        },
        { key: "city", label: "Ville", type: "text" },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.lastName && !row.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) return false;
        if (filters.firstName && !row.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) return false;
        if (filters.etablissement !== "all" && row.etablissementName !== filters.etablissement) return false;
        if (filters.city && !row.etablissementCity?.toLowerCase().includes(filters.city.toLowerCase())) return false;
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/usagers/${row.id}`),
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
      <UsagerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                firstName: editingItem.firstName,
                lastName: editingItem.lastName,
                birthDate: editingItem.birthDate ?? "",
                gender: (editingItem.gender as "M" | "F" | "") ?? "",
                etablissementId: editingItem.etablissementId ?? "",
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
        entityName="l'usager"
        entityLabel={deleteItem ? `${deleteItem.firstName} ${deleteItem.lastName}` : ""}
        isPending={deleteMutation.isPending}
      />
    </DataList>
  );
}

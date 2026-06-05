"use client";

import { useState, useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { UsersIcon } from "@/components/ui/users-icon";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { UsagerFormDialog } from "./usager-form-dialog";
import { UsagerStatusBadge } from "./usager-status-badge";
import {
  USAGER_STATUSES,
  USAGER_STATUS_LABELS,
  USAGER_REGIMES,
  USAGER_REGIME_LABELS,
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
  CLASSES_BY_TYPE,
  type UsagerFormValues,
} from "@/lib/validators/usager";

const CLASSE_LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const list of Object.values(CLASSES_BY_TYPE)) {
    for (const c of list) map[c.value] = c.label;
  }
  return map;
})();

// Barre d'accent à gauche de ligne selon le type de transport (repris de Transcolaire).
const TRANSPORT_ACCENT: Record<string, string> = {
  taxi_collectif_individuel: "bg-blue-500",
  transport_famille: "bg-orange-500",
  transport_commun: "bg-yellow-400",
};

interface UsagerRow {
  id: string;
  displayId: number;
  code: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  status: string;
  regime: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
  secondaryEtablissementId: string | null;
  secondaryEtablissementName: string | null;
  classe: string | null;
  transportType: string | null;
  transportStartDate: string | null;
  transportEndDate: string | null;
  transportParticularity: string | null;
  specificity: string | null;
  notes: string | null;
}

type UsagerFilters = {
  displayId: string;
  code: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  gender: string;
  status: string;
  regime: string;
  classe: string;
  transportType: string;
  etablissementName: string;
  etablissementCity: string;
  secondaryEtablissementName: string;
  transportStartDate: string;
  transportEndDate: string;
  transportParticularity: string;
  specificity: string;
  notes: string;
};

const EMPTY_FILTERS: UsagerFilters = {
  displayId: "",
  code: "",
  lastName: "",
  firstName: "",
  birthDate: "",
  gender: "all",
  status: "all",
  regime: "all",
  classe: "all",
  transportType: "all",
  etablissementName: "all",
  etablissementCity: "",
  secondaryEtablissementName: "all",
  transportStartDate: "",
  transportEndDate: "",
  transportParticularity: "",
  specificity: "",
  notes: "",
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

  const secondaryEtablissementOptions = useMemo(() => {
    if (!usagersList) return [];
    const names = new Set<string>();
    usagersList.forEach((u) => {
      if (u.secondaryEtablissementName) names.add(u.secondaryEtablissementName);
    });
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [usagersList]);

  const classeOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const list of Object.values(CLASSES_BY_TYPE)) {
      for (const c of list) keys.add(c.value);
    }
    return Array.from(keys).map((k) => ({ value: k, label: CLASSE_LABEL_MAP[k] ?? k }));
  }, []);

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
    trpc.usagers.update.mutationOptions({
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

  const deleteManyMutation = useMutation(
    trpc.usagers.deleteMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(`${data.deleted} element${data.deleted > 1 ? "s" : ""} supprime${data.deleted > 1 ? "s" : ""}`);
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
      onBulkDelete={(ids) => deleteManyMutation.mutate({ ids })}
      isBulkDeleting={deleteManyMutation.isPending}
      rowAccent={(row) => TRANSPORT_ACCENT[row.transportType ?? ""] ?? null}
      title="Usagers"
      description="Gerez les eleves transportes"
      emptyIcon={UsersIcon}
      emptyTitle="Aucun usager"
      emptyDescription="Commencez par ajouter votre premier usager."
      addButtonLabel="Ajouter un usager"
      addHref="/usagers/new"
      storageKey="usagers"
      defaultVisibleColumns={[
        "displayId",
        "lastName",
        "firstName",
        "birthDate",
        "etablissementName",
        "etablissementCity",
      ]}
      columns={[
        {
          key: "displayId",
          header: "ID",
          sortable: true,
          className: "w-16",
          render: (row) => (
            <span className="text-muted-foreground tabular-nums">#{row.displayId}</span>
          ),
        },
        {
          key: "code",
          header: "Code",
          sortable: true,
          render: (row) =>
            row.code ? (
              <span className="text-muted-foreground tabular-nums">{row.code}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
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
          header: "Prénom",
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
          key: "gender",
          header: "Genre",
          sortable: true,
          render: (row) =>
            row.gender ? (
              <span className="text-muted-foreground">{row.gender === "M" ? "M" : "F"}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "status",
          header: "Statut",
          sortable: true,
          render: (row) => <UsagerStatusBadge status={row.status} />,
        },
        {
          key: "regime",
          header: "Régime",
          sortable: true,
          render: (row) =>
            row.regime ? (
              <span className="text-muted-foreground">
                {USAGER_REGIME_LABELS[row.regime as keyof typeof USAGER_REGIME_LABELS] ?? row.regime}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "classe",
          header: "Classe",
          sortable: true,
          render: (row) =>
            row.classe ? (
              <span className="text-muted-foreground">
                {CLASSE_LABEL_MAP[row.classe] ?? row.classe}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "transportType",
          header: "Type de transport",
          sortable: true,
          render: (row) =>
            row.transportType ? (
              <span className="text-muted-foreground">
                {USAGER_TRANSPORT_TYPE_LABELS[row.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS] ?? row.transportType}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "etablissementName",
          header: "Établissement",
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
        {
          key: "secondaryEtablissementName",
          header: "Établissement secondaire",
          sortable: true,
          render: (row) =>
            row.secondaryEtablissementName ? (
              <span className="text-muted-foreground">{row.secondaryEtablissementName}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "transportStartDate",
          header: "Début transport",
          sortable: true,
          render: (row) =>
            formatDate(row.transportStartDate) ? (
              <span className="text-muted-foreground">{formatDate(row.transportStartDate)}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "transportEndDate",
          header: "Fin transport",
          sortable: true,
          render: (row) =>
            formatDate(row.transportEndDate) ? (
              <span className="text-muted-foreground">{formatDate(row.transportEndDate)}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "transportParticularity",
          header: "Particularité transport",
          render: (row) =>
            row.transportParticularity ? (
              <span className="text-muted-foreground">{row.transportParticularity}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "specificity",
          header: "Spécificité",
          render: (row) =>
            row.specificity ? (
              <span className="text-muted-foreground">{row.specificity}</span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "notes",
          header: "Notes",
          render: (row) =>
            row.notes ? (
              <span className="text-muted-foreground">{row.notes}</span>
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
        const aRaw = a[column as keyof UsagerRow];
        const bRaw = b[column as keyof UsagerRow];
        let cmp: number;
        if (typeof aRaw === "number" && typeof bRaw === "number") {
          cmp = aRaw - bRaw;
        } else {
          const aVal = (aRaw ?? "") as string;
          const bVal = (bRaw ?? "") as string;
          cmp = aVal.localeCompare(bVal, "fr", { sensitivity: "base" });
        }
        return direction === "asc" ? cmp : -cmp;
      }}
      filters={[
        { key: "displayId", label: "ID", type: "text", placeholder: "#…" },
        { key: "code", label: "Code", type: "text" },
        { key: "lastName", label: "Nom", type: "text" },
        { key: "firstName", label: "Prénom", type: "text" },
        { key: "birthDate", label: "Date de naissance", type: "text", placeholder: "Année ou date…" },
        {
          key: "gender",
          label: "Genre",
          type: "select",
          className: "h-8 w-32 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            { value: "M", label: "Masculin" },
            { value: "F", label: "Féminin" },
          ],
        },
        {
          key: "status",
          label: "Statut",
          type: "select",
          className: "h-8 w-40 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...USAGER_STATUSES.map((s) => ({ value: s, label: USAGER_STATUS_LABELS[s] })),
          ],
        },
        {
          key: "regime",
          label: "Régime",
          type: "select",
          className: "h-8 w-40 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...USAGER_REGIMES.map((r) => ({ value: r, label: USAGER_REGIME_LABELS[r] })),
          ],
        },
        {
          key: "classe",
          label: "Classe",
          type: "select",
          className: "h-8 w-32 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Toutes" },
            ...classeOptions,
          ],
        },
        {
          key: "transportType",
          label: "Type de transport",
          type: "select",
          className: "h-8 w-56 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...USAGER_TRANSPORT_TYPES.map((t) => ({ value: t, label: USAGER_TRANSPORT_TYPE_LABELS[t] })),
          ],
        },
        {
          key: "etablissementName",
          label: "Établissement",
          type: "select",
          className: "h-8 w-56 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...etablissementOptions,
          ],
        },
        { key: "etablissementCity", label: "Ville", type: "text" },
        {
          key: "secondaryEtablissementName",
          label: "Établissement secondaire",
          type: "select",
          className: "h-8 w-56 cursor-pointer text-sm",
          options: [
            { value: "all", label: "Tous" },
            ...secondaryEtablissementOptions,
          ],
        },
        { key: "transportStartDate", label: "Début transport", type: "text", placeholder: "Année ou date…" },
        { key: "transportEndDate", label: "Fin transport", type: "text", placeholder: "Année ou date…" },
        { key: "transportParticularity", label: "Particularité transport", type: "text" },
        { key: "specificity", label: "Spécificité", type: "text" },
        { key: "notes", label: "Notes", type: "text" },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.displayId && !String(row.displayId).includes(filters.displayId.replace(/^#/, ""))) return false;
        if (filters.code && !row.code?.toLowerCase().includes(filters.code.toLowerCase())) return false;
        if (filters.lastName && !row.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) return false;
        if (filters.firstName && !row.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) return false;
        if (filters.birthDate && !(row.birthDate ?? "").includes(filters.birthDate)) return false;
        if (filters.gender !== "all" && row.gender !== filters.gender) return false;
        if (filters.status !== "all" && row.status !== filters.status) return false;
        if (filters.regime !== "all" && row.regime !== filters.regime) return false;
        if (filters.classe !== "all" && row.classe !== filters.classe) return false;
        if (filters.transportType !== "all" && row.transportType !== filters.transportType) return false;
        if (filters.etablissementName !== "all" && row.etablissementName !== filters.etablissementName) return false;
        if (filters.etablissementCity && !row.etablissementCity?.toLowerCase().includes(filters.etablissementCity.toLowerCase())) return false;
        if (filters.secondaryEtablissementName !== "all" && row.secondaryEtablissementName !== filters.secondaryEtablissementName) return false;
        if (filters.transportStartDate && !(row.transportStartDate ?? "").includes(filters.transportStartDate)) return false;
        if (filters.transportEndDate && !(row.transportEndDate ?? "").includes(filters.transportEndDate)) return false;
        if (filters.transportParticularity && !row.transportParticularity?.toLowerCase().includes(filters.transportParticularity.toLowerCase())) return false;
        if (filters.specificity && !row.specificity?.toLowerCase().includes(filters.specificity.toLowerCase())) return false;
        if (filters.notes && !row.notes?.toLowerCase().includes(filters.notes.toLowerCase())) return false;
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Route, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { CircuitFormDialog } from "./circuit-form-dialog";
import type { CircuitFormValues } from "@/lib/validators/circuit";

const DAY_LABELS: Record<number, string> = {
  1: "L",
  2: "M",
  3: "Me",
  4: "J",
  5: "V",
  6: "S",
  7: "D",
};

interface CircuitRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  operatingDays: number[] | null;
  etablissementId: string;
  etablissementName: string | null;
  etablissementCity: string | null;
}

type CircuitFilters = {
  name: string;
  status: string;
};

const EMPTY_FILTERS: CircuitFilters = {
  name: "",
  status: "all",
};

function DayBadges({ days }: { days: number[] | null }) {
  if (!days || days.length === 0) {
    return <span className="text-muted-foreground/60">&mdash;</span>;
  }
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <Badge
          key={d}
          variant={days.includes(d) ? "default" : "outline"}
          className={`h-6 w-7 justify-center px-0 text-xs ${
            days.includes(d)
              ? ""
              : "text-muted-foreground/40 border-border/50"
          }`}
        >
          {DAY_LABELS[d]}
        </Badge>
      ))}
    </div>
  );
}

export function CircuitsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<CircuitRow | null>(null);

  const { data: circuitsList, isLoading, error } = useQuery(
    trpc.circuits.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.circuits.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.circuits.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
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
    <DataList<CircuitRow, CircuitFilters>
      data={circuitsList}
      isLoading={isLoading}
      error={error}
      title="Circuits"
      description="Gerez vos circuits de transport"
      emptyIcon={Route}
      emptyTitle="Aucun circuit"
      emptyDescription="Commencez par ajouter votre premier circuit."
      addButtonLabel="Ajouter un circuit"
      addHref="/circuits/new"
      columns={[
        {
          key: "name",
          header: "Nom",
          render: (row) => (
            <span className="font-medium text-foreground">{row.name}</span>
          ),
        },
        {
          key: "etablissement",
          header: "Etablissement",
          render: (row) =>
            row.etablissementName ? (
              <span className="text-foreground">
                {row.etablissementName}
                {row.etablissementCity && (
                  <span className="text-muted-foreground ml-1">
                    ({row.etablissementCity})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/60">&mdash;</span>
            ),
        },
        {
          key: "operatingDays",
          header: "Jours",
          render: (row) => <DayBadges days={row.operatingDays} />,
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
      onRowClick={(row) => router.push(`/circuits/${row.id}`)}
      filters={[
        { key: "name", label: "Nom", type: "text" },
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
        if (filters.status === "active" && !row.isActive) return false;
        if (filters.status === "inactive" && row.isActive) return false;
        return true;
      }}
      actions={[
        {
          label: "Voir la fiche",
          icon: ExternalLink,
          onClick: (row) => router.push(`/circuits/${row.id}`),
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
    </DataList>
  );
}

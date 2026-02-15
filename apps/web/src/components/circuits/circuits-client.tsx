"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Route, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataList } from "@/components/shared/data-list";
import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { CircuitFormDialog } from "./circuit-form-dialog";
import type { CircuitFormValues } from "@/lib/validators/circuit";

interface CircuitRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  etablissementId: string;
  etablissementName: string | null;
  etablissementCity: string | null;
}

type CircuitFilters = {
  name: string;
};

const EMPTY_FILTERS: CircuitFilters = {
  name: "",
};

export function CircuitsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<CircuitRow | null>(null);

  const { data: circuitsList, isLoading, error } = useQuery(
    trpc.circuits.list.queryOptions(),
  );

  const activeCircuits = circuitsList?.filter((c) => c.isActive) ?? [];
  const inactiveCircuits = circuitsList?.filter((c) => !c.isActive) ?? [];
  const displayedCircuits = activeTab === "active" ? activeCircuits : inactiveCircuits;

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
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "inactive")}>
        <TabsList>
          <TabsTrigger value="active" className="cursor-pointer">
            Actifs
            {!isLoading && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
                {activeCircuits.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="cursor-pointer">
            Inactifs
            {!isLoading && inactiveCircuits.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
                {inactiveCircuits.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

    <DataList<CircuitRow, CircuitFilters>
      data={displayedCircuits}
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
      ]}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/circuits/${row.id}`)}
      filters={[
        { key: "name", label: "Nom", type: "text" },
      ]}
      emptyFilters={EMPTY_FILTERS}
      filterFn={(row, filters) => {
        if (filters.name && !row.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
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
    </div>
  );
}

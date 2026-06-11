"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, ExternalLink, Archive, ArchiveRestore, Copy, CalendarClock } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { UsersIcon } from "@/components/ui/users-icon";
import { DataList } from "@/components/shared/data-list";
import { USAGER_LIST_COLUMNS } from "./list/usager-list-columns";
import {
  useUsagerFilterOptions,
  buildUsagerFilterConfigs,
  usagerFilterFn,
  usagerSortFn,
} from "./list/usager-list-filters";
import { useUsagerListMutations } from "./list/use-usager-list-mutations";
import { UsagerListDialogs } from "./list/usager-list-dialogs";
import { UsagerArchiveTabs } from "./list/usager-archive-tabs";
import { EMPTY_FILTERS, TRANSPORT_ACCENT } from "./list/usager-list-model";
import type { UsagerFormValues } from "@/lib/validators/usager";
import type { UsagerRow, UsagerFilters, SortColumn } from "./list/usager-list-model";

export function UsagersClient({ campaignId }: { campaignId?: string } = {}) {
  const trpc = useTRPC();
  const router = useRouter();
  const isPrepa = !!campaignId;
  // In preparation mode, detail pages open on dedicated routes (back button +
  // sidebar consistent with the Préparation tab).
  const detailBase = isPrepa ? "/preparation/usagers" : "/usagers";

  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<UsagerRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsagerRow | null>(null);
  // Selection being bulk-edited for transport dates (null = dialog closed).
  const [bulkDatesIds, setBulkDatesIds] = useState<string[] | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: usagersList, isLoading, error } = useQuery(
    trpc.usagers.list.queryOptions(campaignId ? { campaignId } : undefined),
  );

  const { data: currentCampaign } = useQuery({
    ...trpc.preparation.getCurrentCampaign.queryOptions(),
    enabled: !isPrepa,
  });

  const {
    copyToPrepaMutation,
    createMutation,
    updateMutation,
    deleteMutation,
    deleteManyMutation,
    updateDatesManyMutation,
    archiveMutation,
  } = useUsagerListMutations({
    onCreateSuccess: () => setFormOpen(false),
    onUpdateSuccess: () => {
      setFormOpen(false);
      setEditingItem(null);
    },
    onDeleteSuccess: () => setDeleteItem(null),
    onUpdateDatesSuccess: () => setBulkDatesIds(null),
  });

  const currentUsagers = usagersList?.filter((u) => !u.archivedAt) ?? [];
  const archivedUsagers = usagersList?.filter((u) => !!u.archivedAt) ?? [];
  const displayedUsagers =
    activeTab === "current" ? currentUsagers : archivedUsagers;

  const { etablissementOptions, secondaryEtablissementOptions, classeOptions } =
    useUsagerFilterOptions(usagersList);

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
    <div className="space-y-4">
      {!isPrepa && (
        <UsagerArchiveTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLoading={isLoading}
          currentCount={currentUsagers.length}
          archivedCount={archivedUsagers.length}
        />
      )}

      <DataList<UsagerRow, UsagerFilters>
        data={displayedUsagers}
        isLoading={isLoading}
        error={error}
        onBulkDelete={(ids) => deleteManyMutation.mutate({ ids })}
        isBulkDeleting={deleteManyMutation.isPending}
        bulkActions={
          isPrepa
            ? undefined
            : [
                {
                  label: "Copier en préparation",
                  icon: Copy,
                  onClick: (ids: string[]) => {
                    if (currentCampaign) {
                      copyToPrepaMutation.mutate({
                        campaignId: currentCampaign.id,
                        usagerIds: ids,
                      });
                    } else {
                      toast.info(
                        "Aucune préparation en cours — démarrez-en une d'abord.",
                      );
                      router.push("/preparation");
                    }
                  },
                },
                {
                  label: "Modifier les dates de transport",
                  icon: CalendarClock,
                  separator: true,
                  onClick: (ids: string[]) => setBulkDatesIds(ids),
                },
              ]
        }
        rowAccent={(row) => TRANSPORT_ACCENT[row.transportType ?? ""] ?? null}
        title="Usagers"
        description="Gérez les élèves transportés"
        emptyIcon={UsersIcon}
        emptyTitle={
          activeTab === "archived" ? "Aucun usager archivé" : "Aucun usager"
        }
        emptyDescription={
          activeTab === "archived"
            ? "Les usagers archivés apparaîtront ici."
            : "Commencez par ajouter votre premier usager."
        }
        addButtonLabel={
          isPrepa || activeTab === "archived" ? undefined : "Ajouter un usager"
        }
        addHref={isPrepa || activeTab === "archived" ? undefined : "/usagers/new"}
        storageKey="usagers"
        defaultVisibleColumns={[
          "displayId",
          "lastName",
          "firstName",
          "birthDate",
          "etablissementName",
          "etablissementCity",
        ]}
        columns={USAGER_LIST_COLUMNS}
        getRowId={(row) => row.id}
        onRowClick={(row) => router.push(`${detailBase}/${row.id}`)}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        sortFn={usagerSortFn}
        filters={buildUsagerFilterConfigs({
          classeOptions,
          etablissementOptions,
          secondaryEtablissementOptions,
        })}
        emptyFilters={EMPTY_FILTERS}
        filterFn={usagerFilterFn}
        actions={[
          {
            label: "Voir la fiche",
            icon: ExternalLink,
            onClick: (row) => router.push(`${detailBase}/${row.id}`),
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
          activeTab === "archived"
            ? {
                label: "Désarchiver",
                icon: ArchiveRestore,
                onClick: (row) =>
                  archiveMutation.mutate({ id: row.id, archived: false }),
              }
            : {
                label: "Archiver",
                icon: Archive,
                onClick: (row) =>
                  archiveMutation.mutate({ id: row.id, archived: true }),
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
        <UsagerListDialogs
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          formMode={formMode}
          editingItem={editingItem}
          onFormSubmit={handleFormSubmit}
          isFormPending={createMutation.isPending || updateMutation.isPending}
          deleteItem={deleteItem}
          setDeleteItem={setDeleteItem}
          onConfirmDelete={(id) => deleteMutation.mutate({ id })}
          isDeletePending={deleteMutation.isPending}
          bulkDatesIds={bulkDatesIds}
          setBulkDatesIds={setBulkDatesIds}
          onBulkDatesSubmit={(input) => updateDatesManyMutation.mutate(input)}
          isBulkDatesPending={updateDatesManyMutation.isPending}
        />
      </DataList>
    </div>
  );
}

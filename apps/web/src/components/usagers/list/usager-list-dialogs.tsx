import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog";
import { UsagerFormDialog } from "@/components/usagers/usager-form-dialog";
import { BulkTransportDatesDialog } from "@/components/usagers/bulk-transport-dates-dialog";
import type { UsagerFormValues } from "@/lib/validators/usager";
import type { UsagerRow } from "./usager-list-model";

interface BulkDatesValues {
  transportStartDate?: string | null;
  transportEndDate?: string | null;
}

interface UsagerListDialogsProps {
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  formMode: "create" | "edit";
  editingItem: UsagerRow | null;
  onFormSubmit: (values: UsagerFormValues) => void;
  isFormPending: boolean;
  deleteItem: UsagerRow | null;
  setDeleteItem: (item: UsagerRow | null) => void;
  onConfirmDelete: (id: string) => void;
  isDeletePending: boolean;
  bulkDatesIds: string[] | null;
  setBulkDatesIds: (ids: string[] | null) => void;
  onBulkDatesSubmit: (input: { ids: string[] } & BulkDatesValues) => void;
  isBulkDatesPending: boolean;
}

export function UsagerListDialogs({
  formOpen,
  setFormOpen,
  formMode,
  editingItem,
  onFormSubmit,
  isFormPending,
  deleteItem,
  setDeleteItem,
  onConfirmDelete,
  isDeletePending,
  bulkDatesIds,
  setBulkDatesIds,
  onBulkDatesSubmit,
  isBulkDatesPending,
}: UsagerListDialogsProps) {
  return (
    <>
      <UsagerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={onFormSubmit}
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
        isPending={isFormPending}
        mode={formMode}
      />

      <EntityDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && onConfirmDelete(deleteItem.id)}
        entityName="l'usager"
        entityLabel={deleteItem ? `${deleteItem.firstName} ${deleteItem.lastName}` : ""}
        isPending={isDeletePending}
      />

      <BulkTransportDatesDialog
        open={bulkDatesIds !== null}
        onOpenChange={(open) => !open && setBulkDatesIds(null)}
        count={bulkDatesIds?.length ?? 0}
        isPending={isBulkDatesPending}
        onSubmit={(values) =>
          bulkDatesIds && onBulkDatesSubmit({ ids: bulkDatesIds, ...values })
        }
      />
    </>
  );
}

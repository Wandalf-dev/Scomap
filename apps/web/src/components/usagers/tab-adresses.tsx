"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, MapPin } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  ADDRESS_TYPES,
  type UsagerAddressFormValues,
} from "@/lib/validators/usager-address";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import { normalizeDays } from "@/lib/types/day-entry";
import { AddressFormDialog } from "./adresses/address-form-dialog";
import { SortableAddressCard } from "./adresses/sortable-address-card";
import { getPositionLabel, getTypeLabel } from "./adresses/address-helpers";
import { useAddressDaysDrafts } from "./adresses/use-address-days-drafts";
import type { OccupiedDay } from "@/components/shared/day-pec-grid";
import type { UsagerAddress } from "@scomap/db/schema";

interface TabAdressesProps {
  usagerId: string;
}

export function TabAdresses({ usagerId }: TabAdressesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UsagerAddress | null>(null);
  const [deleteAddress, setDeleteAddress] = useState<UsagerAddress | null>(null);

  const headerActions = useHeaderActions();

  const { data: addresses, isLoading } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

  // PEC days lock PER ADDRESS: only an address with an active affectation has
  // its days locked (they derive from the affectation → change via avenant for
  // traceability). FREE addresses stay editable, otherwise it would be
  // impossible to prepare the days of a 2nd address before associating it.
  const { data: affectations } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );
  const occupiedAddressIds = new Set(
    (affectations ?? [])
      .map((a) => a.usagerAddressId)
      .filter((id): id is string => !!id),
  );

  // At least one editable (free) address → show the "Enregistrer" button.
  const hasEditableDays = (addresses ?? []).some(
    (a) => !occupiedAddressIds.has(a.id),
  );

  const invalidateAddresses = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerAddresses.list.queryKey({ usagerId }),
    });
  };

  const { savingDays, daysDirty, currentDays, handleDaysChange, handleSaveDays } =
    useAddressDaysDrafts({ usagerId, addresses, invalidateAddresses });

  const createMutation = useMutation(
    trpc.usagerAddresses.create.mutationOptions({
      onSuccess: () => {
        invalidateAddresses();
        toast.success("Adresse ajoutée");
        setFormOpen(false);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'ajout");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.usagerAddresses.update.mutationOptions({
      onSuccess: () => {
        invalidateAddresses();
        toast.success("Adresse modifiée");
        setFormOpen(false);
        setEditingAddress(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.usagerAddresses.delete.mutationOptions({
      onSuccess: () => {
        invalidateAddresses();
        toast.success("Adresse supprimée");
        setDeleteAddress(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const listQueryKey = trpc.usagerAddresses.list.queryKey({ usagerId });

  const reorderMutation = useMutation(
    trpc.usagerAddresses.reorder.mutationOptions({
      onMutate: async ({ items }) => {
        await queryClient.cancelQueries({ queryKey: listQueryKey });
        const previous = queryClient.getQueryData(listQueryKey);

        queryClient.setQueryData(listQueryKey, (old: typeof addresses) => {
          if (!old) return old;
          const posMap = new Map(items.map((i) => [i.id, i.position]));
          return old
            .map((a) => ({ ...a, position: posMap.get(a.id) ?? a.position }))
            .sort((a, b) => a.position - b.position);
        });

        return { previous };
      },
      onSuccess: () => {
        toast.success("Ordre des adresses mis à jour");
      },
      onError: (err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listQueryKey, context.previous);
        }
        toastTrpcError(err, "Erreur lors du réordonnancement");
      },
      onSettled: () => {
        invalidateAddresses();
      },
    }),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const addressCount = addresses?.length ?? 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !addresses) return;

    const oldIndex = addresses.findIndex((a) => a.id === active.id);
    const newIndex = addresses.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(addresses, oldIndex, newIndex);
    const items = reordered.map((a, i) => ({ id: a.id, position: i + 1 }));
    reorderMutation.mutate({ items });
  }

  function handleCreate() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function handleEdit(address: UsagerAddress) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  function handleFormSubmit(values: UsagerAddressFormValues) {
    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data: values });
    } else {
      createMutation.mutate({ usagerId, data: values });
    }
  }

  function getOccupiedDays(excludeId: string, direction: "aller" | "retour"): OccupiedDay[] {
    if (!addresses) return [];
    const result: OccupiedDay[] = [];
    for (const other of addresses) {
      if (other.id === excludeId) continue;
      const days = normalizeDays(direction === "aller" ? other.daysAller : other.daysRetour);
      const label = getPositionLabel(other.position);
      for (const d of days) {
        result.push({ day: d.day, parity: d.parity, label });
      }
    }
    return result;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {headerActions?.target &&
        hasEditableDays &&
        createPortal(
          <Button
            type="button"
            size="sm"
            disabled={!daysDirty || savingDays}
            onClick={handleSaveDays}
            className="cursor-pointer"
          >
            {savingDays ? "Enregistrement..." : "Enregistrer"}
          </Button>,
          headerActions.target,
        )}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Adresses &amp; représentants ({addressCount}/4)
        </h3>
        <Button
          onClick={handleCreate}
          disabled={addressCount >= 4}
          size="sm"
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une adresse
        </Button>
      </div>

      {!addresses || addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MapPin className="size-6" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Aucune adresse
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez une première adresse pour cet usager.
          </p>
        </div>
      ) : (
        <DndContext
          id="usager-adresses-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={addresses.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {addresses.map((addr) => {
                const cur = currentDays(addr);
                return (
                  <SortableAddressCard
                    key={addr.id}
                    addr={addr}
                    positionLabel={getPositionLabel(addr.position)}
                    typeLabel={getTypeLabel(addr.type)}
                    occupiedAller={getOccupiedDays(addr.id, "aller")}
                    occupiedRetour={getOccupiedDays(addr.id, "retour")}
                    onEdit={handleEdit}
                    onDelete={setDeleteAddress}
                    currentAller={cur.aller}
                    currentRetour={cur.retour}
                    onDaysChange={handleDaysChange}
                    canDrag={addressCount > 1}
                    daysReadOnly={occupiedAddressIds.has(addr.id)}
                    lockHref={`/avenants/new?usagerId=${usagerId}`}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Form Dialog */}
      <AddressFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingAddress(null);
        }}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingAddress
            ? {
                position: editingAddress.position,
                type: (editingAddress.type as typeof ADDRESS_TYPES[number]) ?? "",
                civility: editingAddress.civility ?? "",
                responsibleLastName: editingAddress.responsibleLastName ?? "",
                responsibleFirstName: editingAddress.responsibleFirstName ?? "",
                address: editingAddress.address ?? "",
                city: editingAddress.city ?? "",
                postalCode: editingAddress.postalCode ?? "",
                latitude: editingAddress.latitude ?? null,
                longitude: editingAddress.longitude ?? null,
                phone: editingAddress.phone ?? "",
                mobile: editingAddress.mobile ?? "",
                secondaryPhone: editingAddress.secondaryPhone ?? "",
                secondaryMobile: editingAddress.secondaryMobile ?? "",
                email: editingAddress.email ?? "",
                authorizedPerson: editingAddress.authorizedPerson ?? "",
                observations: editingAddress.observations ?? "",
                daysAller: normalizeDays(editingAddress.daysAller),
                daysRetour: normalizeDays(editingAddress.daysRetour),
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={editingAddress ? "edit" : "create"}
        nextPosition={addressCount + 1}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteAddress}
        onOpenChange={(open) => !open && setDeleteAddress(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;adresse</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;adresse{" "}
              <strong>{getTypeLabel(deleteAddress?.type ?? null) || `n°${deleteAddress?.position}`}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAddress && deleteMutation.mutate({ id: deleteAddress.id })}
              disabled={deleteMutation.isPending}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

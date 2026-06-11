"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Plus, MapPin, Lock, ArrowDownUp } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArretFormDialog } from "./arrets/arret-form-dialog";
import { SortableArretRow } from "./arrets/sortable-arret-row";
import { useArretMutations } from "./arrets/use-arret-mutations";
import { restrictToVerticalAxis } from "./arrets/arret-helpers";
import type { ArretFormValues } from "@/lib/validators/trajet";
import type { ArretRow } from "./arrets/types";

interface TabArretsProps {
  trajetId: string;
}

export function TrajetArrets({ trajetId }: TabArretsProps) {
  const trpc = useTRPC();

  const [formOpen, setFormOpen] = useState(false);
  const [editingArret, setEditingArret] = useState<ArretRow | null>(null);
  const [deleteArret, setDeleteArret] = useState<ArretRow | null>(null);

  const { data: arretsList, isLoading } = useQuery(
    // Full composition of the trajet (including upcoming arrêts from an avenant).
    trpc.arrets.list.queryOptions({ trajetId, all: true }),
  );

  const {
    createMutation,
    updateMutation,
    deleteMutation,
    toggleLockMutation,
    reorderMutation,
    setTimeMutation,
  } = useArretMutations({
    trajetId,
    onCreateSuccess: () => setFormOpen(false),
    onUpdateSuccess: () => {
      setFormOpen(false);
      setEditingArret(null);
    },
    onDeleteSuccess: () => setDeleteArret(null),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !arretsList) return;
    const oldIndex = arretsList.findIndex((a) => a.id === active.id);
    const newIndex = arretsList.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(arretsList, oldIndex, newIndex);
    const items = reordered.map((a, i) => ({ id: a.id, orderIndex: i }));
    reorderMutation.mutate({ trajetId, items });
  }

  function handleInvert() {
    if (!arretsList || arretsList.length < 2) return;
    const items = [...arretsList]
      .reverse()
      .map((a, i) => ({ id: a.id, orderIndex: i }));
    reorderMutation.mutate({ trajetId, items });
  }

  function handleCreate() {
    setEditingArret(null);
    setFormOpen(true);
  }

  function handleEdit(arret: ArretRow) {
    setEditingArret(arret);
    setFormOpen(true);
  }

  function handleFormSubmit(values: ArretFormValues) {
    if (editingArret) {
      updateMutation.mutate({ id: editingArret.id, trajetId, data: values });
    } else {
      createMutation.mutate({ trajetId, data: values });
    }
  }

  function handleToggleLock(arret: ArretRow) {
    toggleLockMutation.mutate({ id: arret.id, trajetId });
  }

  function handleSetTime(arret: ArretRow, time: string | null) {
    setTimeMutation.mutate({ id: arret.id, trajetId, arrivalTime: time });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const nextOrderIndex = arretsList ? arretsList.length : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Arrêts ({arretsList?.length ?? 0})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleInvert}
            size="sm"
            variant="outline"
            disabled={
              !arretsList || arretsList.length < 2 || reorderMutation.isPending
            }
            className="cursor-pointer"
          >
            <ArrowDownUp className="mr-2 h-4 w-4" />
            Inverser l&apos;ordre
          </Button>
          <Button onClick={handleCreate} size="sm" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un point
          </Button>
        </div>
      </div>

      {!arretsList || arretsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-16">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun arrêt
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un premier arrêt pour ce trajet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[0.3rem] border border-border bg-card">
          <DndContext
            id="trajet-arrets-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            autoScroll={false}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[32px]" />
                  <TableHead className="w-[40px] text-center">#</TableHead>
                  <TableHead>Nom / Adresse</TableHead>
                  <TableHead className="w-[140px]">Horaire</TableHead>
                  <TableHead
                    className="w-[44px] text-center"
                    title="Verrouiller l'horaire : il ne sera pas recalculé lors du calcul des horaires"
                  >
                    <Lock className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                  </TableHead>
                  <TableHead className="w-[80px] text-right">Km</TableHead>
                  <TableHead className="w-[70px] text-right">Tps (s)</TableHead>
                  <TableHead className="w-[130px]">GPS</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={arretsList.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {arretsList.map((arret, idx) => (
                    <SortableArretRow
                      key={arret.id}
                      arret={arret}
                      position={idx + 1}
                      onEdit={handleEdit}
                      onDelete={setDeleteArret}
                      onToggleLock={handleToggleLock}
                      onSetTime={handleSetTime}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      )}

      {/* Form Dialog */}
      <ArretFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingArret(null);
        }}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingArret
            ? {
                type:
                  (editingArret.type as "usager" | "etablissement") ?? "usager",
                usagerAddressId: editingArret.usagerAddressId ?? undefined,
                etablissementId: editingArret.etablissementId ?? undefined,
                name: editingArret.name,
                address: editingArret.address ?? "",
                latitude: editingArret.latitude ?? undefined,
                longitude: editingArret.longitude ?? undefined,
                orderIndex: editingArret.orderIndex,
                arrivalTime: editingArret.arrivalTime ?? "",
                waitTime: editingArret.waitTime ?? undefined,
              }
            : undefined
        }
        nextOrderIndex={nextOrderIndex}
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={editingArret ? "edit" : "create"}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteArret}
        onOpenChange={(open) => !open && setDeleteArret(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;arrêt</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>{deleteArret?.name}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteArret &&
                deleteMutation.mutate({ id: deleteArret.id, trajetId })
              }
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

// Keep backward compat export for any other consumers
export { TrajetArrets as TabArrets };

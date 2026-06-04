"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import {
  arretSchema,
  type ArretFormValues,
} from "@/lib/validators/trajet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  MapPin,
  User,
  School,
  Lock,
  GripVertical,
  ArrowDownUp,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { UsagerSelector } from "./usager-selector";
import { EtablissementSelector } from "../circuits/etablissement-selector";

interface ArretRow {
  id: string;
  trajetId: string;
  type: string | null;
  usagerAddressId: string | null;
  etablissementId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderIndex: number;
  arrivalTime: string | null;
  waitTime: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  timeLocked: boolean;
  usagerId: string | null;
  usagerFirstName: string | null;
  usagerLastName: string | null;
  usagerAddressType: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
}

interface TabArretsProps {
  trajetId: string;
}

// Rows live in a table: lock the drag to the vertical axis AND keep it within
// the list container so a row can't be dragged out of its block.
const restrictToVerticalAxis: Modifier = ({
  transform,
  draggingNodeRect,
  containerNodeRect,
}) => {
  const next = { ...transform, x: 0 };
  if (!draggingNodeRect || !containerNodeRect) return next;
  if (draggingNodeRect.top + next.y < containerNodeRect.top) {
    next.y = containerNodeRect.top - draggingNodeRect.top;
  } else if (draggingNodeRect.bottom + next.y > containerNodeRect.bottom) {
    next.y = containerNodeRect.bottom - draggingNodeRect.bottom;
  }
  return next;
};

function isEtablissement(arret: ArretRow) {
  return arret.type === "etablissement";
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  return String(seconds);
}

function formatKm(km: number | null) {
  if (km == null) return "—";
  return km.toFixed(3);
}

function formatGps(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function TrajetArrets({ trajetId }: TabArretsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingArret, setEditingArret] = useState<ArretRow | null>(null);
  const [deleteArret, setDeleteArret] = useState<ArretRow | null>(null);

  const { data: arretsList, isLoading } = useQuery(
    trpc.arrets.list.queryOptions({ trajetId }),
  );

  const createMutation = useMutation(
    trpc.arrets.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arret ajoute");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de l'ajout");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.arrets.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arret modifie");
        setFormOpen(false);
        setEditingArret(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.arrets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arret supprime");
        setDeleteArret(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const toggleLockMutation = useMutation(
    trpc.arrets.toggleTimeLock.mutationOptions({
      onMutate: async ({ id }) => {
        const queryKey = trpc.arrets.list.queryKey({ trajetId });
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === id ? { ...a, timeLocked: !a.timeLocked } : a,
          );
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.arrets.list.queryKey({ trajetId }),
            context.previous,
          );
        }
        toast.error("Erreur lors du verrouillage");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

  const reorderMutation = useMutation(
    trpc.arrets.reorder.mutationOptions({
      onMutate: async ({ items }) => {
        const queryKey = trpc.arrets.list.queryKey({ trajetId });
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          const posMap = new Map(items.map((i) => [i.id, i.orderIndex]));
          return [...old]
            .map((a) => ({ ...a, orderIndex: posMap.get(a.id) ?? a.orderIndex }))
            .sort((a, b) => a.orderIndex - b.orderIndex);
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.arrets.list.queryKey({ trajetId }),
            context.previous,
          );
        }
        toast.error("Erreur lors du reordonnancement");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

  const setTimeMutation = useMutation(
    trpc.arrets.setArrivalTime.mutationOptions({
      onMutate: async ({ id, arrivalTime }) => {
        const queryKey = trpc.arrets.list.queryKey({ trajetId });
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === id ? { ...a, arrivalTime: arrivalTime || null } : a,
          );
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.arrets.list.queryKey({ trajetId }),
            context.previous,
          );
        }
        toast.error("Erreur lors de la mise a jour de l'horaire");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

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
          Arrets ({arretsList?.length ?? 0})
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
            Aucun arret
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un premier arret pour ce trajet.
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
                  <TableHead className="w-[96px]">Horaire</TableHead>
                  <TableHead
                    className="w-[44px] text-center"
                    title="Verrouiller l'horaire : il ne sera pas recalcule lors du calcul des horaires"
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
            <AlertDialogTitle>Supprimer l&apos;arret</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer{" "}
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

// --- Sortable Arret Row ---

interface SortableArretRowProps {
  arret: ArretRow;
  position: number;
  onEdit: (arret: ArretRow) => void;
  onDelete: (arret: ArretRow) => void;
  onToggleLock: (arret: ArretRow) => void;
  onSetTime: (arret: ArretRow, time: string | null) => void;
}

function SortableArretRow({
  arret,
  position,
  onEdit,
  onDelete,
  onToggleLock,
  onSetTime,
}: SortableArretRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: arret.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const ecole = isEtablissement(arret);

  return (
    <TableRow ref={setNodeRef} style={style} className="group">
      <TableCell className="px-1 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-7 w-6 items-center justify-center cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-foreground"
          aria-label="Reordonner l'arret"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-center font-mono text-sm text-muted-foreground">
        {String(position).padStart(2, "0")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {arret.type === "usager" ? (
            <User className="h-4 w-4 shrink-0 text-amber-600" />
          ) : arret.type === "etablissement" ? (
            <School className="h-4 w-4 shrink-0 text-blue-600" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            {arret.type === "usager" && arret.usagerId ? (
              <Link
                href={`/usagers/${arret.usagerId}`}
                className="font-medium text-sm text-primary hover:underline cursor-pointer"
              >
                {arret.name}
              </Link>
            ) : arret.type === "etablissement" && arret.etablissementId ? (
              <Link
                href={`/etablissements/${arret.etablissementId}`}
                className="font-medium text-sm text-primary hover:underline cursor-pointer"
              >
                {arret.name}
              </Link>
            ) : (
              <span className="font-medium text-sm">{arret.name}</span>
            )}
            {arret.address && (
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {arret.address}
              </p>
            )}
          </div>
          {ecole && (
            <Badge
              variant="outline"
              className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 text-xs shrink-0"
            >
              Ecole
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <ArretTimeInput
          value={arret.arrivalTime}
          locked={arret.timeLocked}
          onCommit={(t) => onSetTime(arret, t)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={arret.timeLocked}
          onCheckedChange={() => onToggleLock(arret)}
          className="cursor-pointer"
          title="Verrouiller cet horaire : ignore lors du calcul des horaires"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatKm(arret.distanceKm)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatDuration(arret.durationSeconds)}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatGps(arret.latitude, arret.longitude)}
      </TableCell>
      <TableCell>
        {!ecole && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onEdit(arret)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(arret)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

// --- Inline arrival time input ---

function ArretTimeInput({
  value,
  locked,
  onCommit,
}: {
  value: string | null;
  locked: boolean;
  onCommit: (time: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");

  // Keep in sync when the underlying value changes (e.g. after a calc)
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  function commit() {
    const next = local || null;
    if (next !== (value ?? null)) onCommit(next);
  }

  return (
    <input
      type="time"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      title={locked ? "Horaire verrouille" : undefined}
      className={`h-7 w-[5.5rem] rounded-[0.3rem] border bg-background px-2 font-mono text-sm tabular-nums outline-none transition-colors focus:border-ring ${
        locked ? "border-primary/50 text-primary" : "border-input"
      }`}
    />
  );
}

// --- Arret Form Dialog ---

interface ArretFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ArretFormValues) => void;
  defaultValues?: Partial<ArretFormValues>;
  nextOrderIndex: number;
  isPending: boolean;
  mode: "create" | "edit";
}

function ArretFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  nextOrderIndex,
  isPending,
  mode,
}: ArretFormDialogProps) {
  const [selectedType, setSelectedType] = useState<"usager" | "etablissement">(
    (defaultValues?.type as "usager" | "etablissement") ?? "usager",
  );

  const form = useForm<ArretFormValues>({
    resolver: zodResolver(arretSchema),
    defaultValues: {
      type: "usager",
      usagerAddressId: undefined,
      etablissementId: undefined,
      name: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      orderIndex: nextOrderIndex,
      arrivalTime: "",
      waitTime: undefined,
      ...defaultValues,
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const type =
        (defaultValues?.type as "usager" | "etablissement") ?? "usager";
      setSelectedType(type);
      form.reset({
        type,
        usagerAddressId: undefined,
        etablissementId: undefined,
        name: "",
        address: "",
        latitude: undefined,
        longitude: undefined,
        orderIndex: nextOrderIndex,
        arrivalTime: "",
        waitTime: undefined,
        ...defaultValues,
      });
    }
    onOpenChange(open);
  };

  function handleTypeChange(type: "usager" | "etablissement") {
    setSelectedType(type);
    form.setValue("type", type);
    form.setValue("usagerAddressId", undefined);
    form.setValue("etablissementId", undefined);
    form.setValue("name", "");
    form.setValue("address", "");
    form.setValue("latitude", undefined);
    form.setValue("longitude", undefined);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter un arret" : "Modifier l'arret"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
            {/* Type selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedType === "usager" ? "default" : "outline"}
                onClick={() => handleTypeChange("usager")}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Usager
              </Button>
              <Button
                type="button"
                variant={
                  selectedType === "etablissement" ? "default" : "outline"
                }
                onClick={() => handleTypeChange("etablissement")}
                className="cursor-pointer"
              >
                <School className="mr-2 h-4 w-4" />
                Etablissement
              </Button>
            </div>

            {/* Selector based on type */}
            {selectedType === "usager" ? (
              <UsagerSelector
                selectedUsagerAddressId={form.watch("usagerAddressId")}
                onSelect={(result) => {
                  form.setValue("usagerAddressId", result.usagerAddressId);
                  form.setValue("etablissementId", undefined);
                  form.setValue("name", result.usagerName);
                  form.setValue("address", result.address);
                  form.setValue("latitude", result.latitude ?? undefined);
                  form.setValue("longitude", result.longitude ?? undefined);
                }}
              />
            ) : (
              <EtablissementSelector
                selectedEtablissementId={form.watch("etablissementId")}
                onSelect={(result) => {
                  form.setValue("etablissementId", result.etablissementId);
                  form.setValue("usagerAddressId", undefined);
                  form.setValue("name", result.name);
                  form.setValue("address", result.address);
                  form.setValue("latitude", result.latitude ?? undefined);
                  form.setValue("longitude", result.longitude ?? undefined);
                }}
              />
            )}

            {/* Auto-filled fields (read-only) */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nom de l'arret"
                      className="bg-muted"
                      readOnly
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Adresse"
                      className="bg-muted"
                      readOnly
                      value={field.value ?? ""}
                      onChange={() => {}}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="arrivalTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure d&apos;arrivee</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waitTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attente (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(
                            v === "" ? undefined : parseInt(v, 10),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="cursor-pointer"
              >
                {isPending
                  ? "Enregistrement..."
                  : mode === "create"
                    ? "Ajouter"
                    : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

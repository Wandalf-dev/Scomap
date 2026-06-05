"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  usagerAddressSchema,
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS,
  type UsagerAddressFormValues,
} from "@/lib/validators/usager-address";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, PencilLine, Trash2, MapPin, Phone, Mail, UserCheck, GripVertical } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/forms/address-autocomplete-input";
import { DayPecGrid, type OccupiedDay } from "@/components/shared/day-pec-grid";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { normalizeDays, areDayEntriesEqual, type DayEntry } from "@/lib/types/day-entry";
import type { UsagerAddress } from "@scomap/db/schema";

type DraftDays = { aller: DayEntry[]; retour: DayEntry[] };

const CIVILITIES = [
  { value: "M.", label: "M." },
  { value: "Mme", label: "Mme" },
];


interface TabAdressesProps {
  usagerId: string;
}

export function TabAdresses({ usagerId }: TabAdressesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UsagerAddress | null>(null);
  const [deleteAddress, setDeleteAddress] = useState<UsagerAddress | null>(null);

  // Brouillon des jours de PEC par adresse : rien n'est écrit en base tant que
  // l'utilisateur n'a pas cliqué « Enregistrer » (bouton du header). Pour annuler,
  // il quitte la fiche (le bouton Retour avertit via le contexte unsaved-changes).
  const [drafts, setDrafts] = useState<Record<string, DraftDays>>({});
  const [savingDays, setSavingDays] = useState(false);
  const headerActions = useHeaderActions();
  const unsaved = useUnsavedChanges();

  const { data: addresses, isLoading } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

  // Dès qu'une affectation circuit active existe, les jours de PEC ne s'éditent
  // plus directement (ils dérivent de l'affectation) : modification via avenant
  // uniquement, pour la traçabilité. Cohérent avec le verrou de tab-identite
  // (dates) et tab-circuits (adresse de PEC).
  const { data: affectations } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );
  const affectationLocked = (affectations?.length ?? 0) > 0;

  const invalidateAddresses = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerAddresses.list.queryKey({ usagerId }),
    });
  };

  const createMutation = useMutation(
    trpc.usagerAddresses.create.mutationOptions({
      onSuccess: () => {
        invalidateAddresses();
        toast.success("Adresse ajoutée");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de l'ajout");
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
      onError: () => {
        toast.error("Erreur lors de la modification");
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
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  // Mutation pour enregistrer les jours de PEC (déclenchée par le bouton du header).
  // Feedback (toast) et invalidations gérés en lot dans handleSaveDays — pas
  // d'invalidation par appel (qui multiplierait les refetches et concurrencerait
  // l'écriture optimiste du cache).
  const updateDaysMutation = useMutation(
    trpc.usagerAddresses.update.mutationOptions(),
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
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listQueryKey, context.previous);
        }
        toast.error("Erreur lors du réordonnancement");
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

  function getPositionLabel(position: number): string {
    return position === 1 ? "Adresse principale" : `Adresse ${position}`;
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

  function buildDaysData(a: UsagerAddress) {
    return {
      position: a.position,
      type: (a.type ?? "") as typeof ADDRESS_TYPES[number] | "",
      civility: a.civility ?? "",
      responsibleLastName: a.responsibleLastName ?? "",
      responsibleFirstName: a.responsibleFirstName ?? "",
      address: a.address ?? "",
      city: a.city ?? "",
      postalCode: a.postalCode ?? "",
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      phone: a.phone ?? "",
      mobile: a.mobile ?? "",
      secondaryPhone: a.secondaryPhone ?? "",
      secondaryMobile: a.secondaryMobile ?? "",
      email: a.email ?? "",
      authorizedPerson: a.authorizedPerson ?? "",
      observations: a.observations ?? "",
    };
  }

  // Valeur courante (brouillon si édité, sinon valeur serveur) des jours d'une adresse.
  function currentDays(a: UsagerAddress): DraftDays {
    return (
      drafts[a.id] ?? {
        aller: normalizeDays(a.daysAller),
        retour: normalizeDays(a.daysRetour),
      }
    );
  }

  function isAddrDaysDirty(a: UsagerAddress): boolean {
    const d = drafts[a.id];
    if (!d) return false;
    return (
      !areDayEntriesEqual(d.aller, normalizeDays(a.daysAller)) ||
      !areDayEntriesEqual(d.retour, normalizeDays(a.daysRetour))
    );
  }

  function handleDaysChange(addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) {
    setDrafts((prev) => ({ ...prev, [addr.id]: { aller, retour } }));
  }

  const dirtyAddresses = (addresses ?? []).filter(isAddrDaysDirty);
  const daysDirty = dirtyAddresses.length > 0;

  async function handleSaveDays() {
    if (!daysDirty || savingDays) return;
    setSavingDays(true);
    const targets = dirtyAddresses;
    const results = await Promise.allSettled(
      targets.map((a) => {
        const d = drafts[a.id]!;
        return updateDaysMutation.mutateAsync({
          id: a.id,
          data: { ...buildDaysData(a), daysAller: d.aller, daysRetour: d.retour },
        });
      }),
    );
    // On purge uniquement les brouillons réellement enregistrés.
    const savedIds = targets
      .filter((_, i) => results[i]!.status === "fulfilled")
      .map((a) => a.id);
    if (savedIds.length > 0) {
      // Écrit les jours sauvés dans le cache (optimiste) pour éviter un flash de
      // l'ancienne valeur avant le refetch, puis purge le brouillon correspondant.
      queryClient.setQueryData(listQueryKey, (old: typeof addresses) => {
        if (!old) return old;
        return old.map((a) =>
          savedIds.includes(a.id)
            ? { ...a, daysAller: drafts[a.id]!.aller, daysRetour: drafts[a.id]!.retour }
            : a,
        );
      });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const id of savedIds) delete next[id];
        return next;
      });
      // Réconciliation serveur, une seule fois pour tout le lot.
      invalidateAddresses();
      queryClient.invalidateQueries({
        queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
      });
    }
    setSavingDays(false);
    if (results.some((r) => r.status === "rejected")) {
      toast.error("Erreur lors de l'enregistrement des jours");
    } else {
      toast.success("Jours de prise en charge enregistrés");
    }
  }

  // Signale les jours non enregistrés au layout : le bouton « Retour » avertit
  // alors avant de quitter la fiche (et c'est ainsi qu'on « annule »).
  const setUnsavedDirty = unsaved?.setDirty;
  useEffect(() => {
    setUnsavedDirty?.("usager-adresses-days", daysDirty);
    return () => setUnsavedDirty?.("usager-adresses-days", false);
  }, [daysDirty, setUnsavedDirty]);

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

  function getTypeLabel(type: string | null): string {
    if (!type) return "";
    return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
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
        !affectationLocked &&
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
                    daysReadOnly={affectationLocked}
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

// --- Sortable Address Card ---

interface SortableAddressCardProps {
  addr: UsagerAddress & { daysAller: DayEntry[]; daysRetour: DayEntry[] };
  positionLabel: string;
  typeLabel: string;
  occupiedAller: OccupiedDay[];
  occupiedRetour: OccupiedDay[];
  onEdit: (addr: UsagerAddress) => void;
  onDelete: (addr: UsagerAddress) => void;
  currentAller: DayEntry[];
  currentRetour: DayEntry[];
  onDaysChange: (addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) => void;
  canDrag: boolean;
  daysReadOnly: boolean;
  lockHref: string;
}

function SortableAddressCard({
  addr,
  positionLabel,
  typeLabel,
  occupiedAller,
  occupiedRetour,
  onEdit,
  onDelete,
  currentAller,
  currentRetour,
  onDaysChange,
  canDrag,
  daysReadOnly,
  lockHref,
}: SortableAddressCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: addr.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style} className="gap-4 rounded-2xl border-border shadow-xs">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        {canDrag && (
          <button
            type="button"
            className="-ml-1 cursor-grab touch-none text-muted-foreground/45 transition-colors hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </button>
        )}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <MapPin className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CardTitle className="text-base font-bold tracking-tight">
            {positionLabel}
          </CardTitle>
          {typeLabel && (
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {typeLabel}
            </span>
          )}
          {addr.responsibleLastName && (
            <span className="text-sm text-muted-foreground">
              — {addr.civility} {addr.responsibleFirstName} {addr.responsibleLastName}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(addr)}
          >
            <PencilLine className="size-4" />
            <span className="sr-only">Modifier</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg text-destructive hover:text-destructive"
            onClick={() => onDelete(addr)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Supprimer</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2.5 text-sm">
          {addr.address && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {addr.address}
                {addr.postalCode || addr.city
                  ? ` — ${[addr.postalCode, addr.city].filter(Boolean).join(" ")}`
                  : ""}
              </span>
            </div>
          )}
          {(addr.phone || addr.mobile || addr.secondaryPhone || addr.secondaryMobile) && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {[addr.phone, addr.mobile, addr.secondaryPhone, addr.secondaryMobile].filter(Boolean).join(" / ")}
              </span>
            </div>
          )}
          {addr.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span>{addr.email}</span>
            </div>
          )}
          {addr.authorizedPerson && (
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 shrink-0 text-muted-foreground" />
              <span>Personne autorisée : {addr.authorizedPerson}</span>
            </div>
          )}
          {addr.observations && (
            <p className="text-muted-foreground italic">
              {addr.observations}
            </p>
          )}
        </div>

        {/* Jours de PEC inline sous l'adresse */}
        <div className="mt-4 border-t border-border pt-4">
          <DayPecGrid
            daysAller={currentAller}
            daysRetour={currentRetour}
            occupiedAller={occupiedAller}
            occupiedRetour={occupiedRetour}
            onChange={(aller, retour) => onDaysChange(addr, aller, retour)}
            readOnly={daysReadOnly}
            lockHref={lockHref}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Address Form Dialog ---

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UsagerAddressFormValues) => void;
  defaultValues?: UsagerAddressFormValues;
  isPending: boolean;
  mode: "create" | "edit";
  nextPosition: number;
}

function AddressFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  mode,
  nextPosition,
}: AddressFormDialogProps) {
  const emptyValues: UsagerAddressFormValues = {
    position: nextPosition,
    type: "",
    civility: "",
    responsibleLastName: "",
    responsibleFirstName: "",
    address: "",
    city: "",
    postalCode: "",
    latitude: null,
    longitude: null,
    phone: "",
    mobile: "",
    secondaryPhone: "",
    secondaryMobile: "",
    email: "",
    authorizedPerson: "",
    observations: "",
    daysAller: [],
    daysRetour: [],
  };

  const form = useForm<UsagerAddressFormValues>({
    resolver: zodResolver(usagerAddressSchema),
    defaultValues: defaultValues ?? emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues ?? emptyValues);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter une adresse" : "Modifier l'adresse"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 pt-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ADDRESS_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="cursor-pointer">
                          {ADDRESS_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Responsable */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="civility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civilité</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIVILITIES.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="responsibleLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom responsable</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="responsibleFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom responsable</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Adresse */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <AddressAutocompleteInput
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onSelect={(s) => {
                        form.setValue("address", s.address);
                        form.setValue("city", s.city);
                        form.setValue("postalCode", s.postalCode);
                        form.setValue("latitude", s.latitude);
                        form.setValue("longitude", s.longitude);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="Ville" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal</FormLabel>
                    <FormControl>
                      <Input placeholder="00000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        readOnly
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        readOnly
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone fixe</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portable</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="secondaryPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone fixe secondaire</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryMobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portable secondaire</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemple.fr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="authorizedPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personne autorisée à récupérer l&apos;enfant</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom et prénom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observations</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notes..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              <Button type="submit" disabled={isPending} className="cursor-pointer">
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

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
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
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
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
import { Plus, Pencil, Trash2, MapPin, Phone, Mail, UserCheck, GripVertical, Bus } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/forms/address-autocomplete-input";
import { DayPecGrid, type OccupiedDay } from "@/components/shared/day-pec-grid";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";
import type { UsagerAddress } from "@scomap/db/schema";

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

  const { data: addresses, isLoading } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

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

  // Mutation pour mettre à jour les jours de PEC inline
  const updateDaysMutation = useMutation(
    trpc.usagerAddresses.update.mutationOptions({
      onSuccess: () => {
        invalidateAddresses();
        queryClient.invalidateQueries({
          queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
        });
        toast.success("Jours de PEC enregistrés");
      },
      onError: () => {
        toast.error("Erreur lors de la mise à jour des jours");
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
      transportType: (a.transportType as typeof USAGER_TRANSPORT_TYPES[number] | "") ?? "",
      observations: a.observations ?? "",
    };
  }

  function handleDaysSave(addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) {
    updateDaysMutation.mutate({
      id: addr.id,
      data: { ...buildDaysData(addr), daysAller: aller, daysRetour: retour },
    });
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
      <div className="flex justify-end">
        <Button
          onClick={handleCreate}
          disabled={addressCount >= 4}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une adresse
        </Button>
      </div>

      {!addresses || addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucune adresse
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez une première adresse pour cet usager.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={addresses.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {addresses.map((addr) => (
                <SortableAddressCard
                  key={addr.id}
                  addr={addr}
                  positionLabel={getPositionLabel(addr.position)}
                  typeLabel={getTypeLabel(addr.type)}
                  occupiedAller={getOccupiedDays(addr.id, "aller")}
                  occupiedRetour={getOccupiedDays(addr.id, "retour")}
                  onEdit={handleEdit}
                  onDelete={setDeleteAddress}
                  onDaysSave={handleDaysSave}
                  canDrag={addressCount > 1}
                />
              ))}
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
                transportType: (editingAddress.transportType as typeof USAGER_TRANSPORT_TYPES[number] | "") ?? "",
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
  onDaysSave: (addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) => void;
  canDrag: boolean;
}

function SortableAddressCard({
  addr,
  positionLabel,
  typeLabel,
  occupiedAller,
  occupiedRetour,
  onEdit,
  onDelete,
  onDaysSave,
  canDrag,
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
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {canDrag && (
            <button
              type="button"
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground transition-colors"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-base">
              {positionLabel}
            </CardTitle>
            {typeLabel && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-[0.3rem]">
                {typeLabel}
              </span>
            )}
            {addr.responsibleLastName && (
              <span className="text-sm text-muted-foreground">
                — {addr.civility} {addr.responsibleFirstName} {addr.responsibleLastName}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => onEdit(addr)}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Modifier</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
            onClick={() => onDelete(addr)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Supprimer</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {addr.address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {[addr.phone, addr.mobile, addr.secondaryPhone, addr.secondaryMobile].filter(Boolean).join(" / ")}
            </span>
          </div>
        )}
        {addr.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{addr.email}</span>
          </div>
        )}
        {addr.authorizedPerson && (
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Personne autorisée : {addr.authorizedPerson}</span>
          </div>
        )}
        {addr.transportType && (
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{USAGER_TRANSPORT_TYPE_LABELS[addr.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS] ?? addr.transportType}</span>
          </div>
        )}
        {addr.observations && (
          <p className="mt-1 text-muted-foreground italic">
            {addr.observations}
          </p>
        )}

        {/* Jours de PEC inline sous l'adresse */}
        <div className="mt-3 border-t pt-3">
          <DayPecGrid
            daysAller={normalizeDays(addr.daysAller)}
            daysRetour={normalizeDays(addr.daysRetour)}
            occupiedAller={occupiedAller}
            occupiedRetour={occupiedRetour}
            onSave={(aller, retour) => onDaysSave(addr, aller, retour)}
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
    transportType: "",
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
                        className="bg-muted"
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
                        className="bg-muted"
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
              name="transportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de transport</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USAGER_TRANSPORT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="cursor-pointer">
                          {USAGER_TRANSPORT_TYPE_LABELS[t]}
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

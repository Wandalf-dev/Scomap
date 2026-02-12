"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  usagerAddressSchema,
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
import { Plus, Pencil, Trash2, MapPin, Phone, Mail, Calendar } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/forms/address-autocomplete-input";
import { DayPecGrid } from "@/components/shared/day-pec-grid";
import { DayBadges } from "@/components/shared/day-badges";
import { normalizeDays } from "@/lib/types/day-entry";
import type { UsagerAddress } from "@scomap/db/schema";

const CIVILITIES = [
  { value: "M.", label: "M." },
  { value: "Mme", label: "Mme" },
];

const LABELS = [
  { value: "Domicile", label: "Domicile" },
  { value: "Père", label: "Père" },
  { value: "Mère", label: "Mère" },
  { value: "Autre", label: "Autre" },
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

  const createMutation = useMutation(
    trpc.usagerAddresses.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagerAddresses.list.queryKey({ usagerId }),
        });
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
        queryClient.invalidateQueries({
          queryKey: trpc.usagerAddresses.list.queryKey({ usagerId }),
        });
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
        queryClient.invalidateQueries({
          queryKey: trpc.usagerAddresses.list.queryKey({ usagerId }),
        });
        toast.success("Adresse supprimée");
        setDeleteAddress(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const addressCount = addresses?.length ?? 0;

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
        <div className="space-y-4">
          {addresses.map((addr) => (
            <Card key={addr.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {addr.label || `Adresse ${addr.position}`}
                  </CardTitle>
                  {addr.responsibleLastName && (
                    <span className="text-sm text-muted-foreground">
                      — {addr.civility} {addr.responsibleFirstName} {addr.responsibleLastName}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => handleEdit(addr)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Modifier</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setDeleteAddress(addr)}
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
                {(addr.phone || addr.mobile) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      {[addr.phone, addr.mobile].filter(Boolean).join(" / ")}
                    </span>
                  </div>
                )}
                {addr.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{addr.email}</span>
                  </div>
                )}
                {addr.observations && (
                  <p className="mt-1 text-muted-foreground italic">
                    {addr.observations}
                  </p>
                )}
                {(normalizeDays(addr.daysAller).length > 0 || normalizeDays(addr.daysRetour).length > 0) && (
                  <div className="mt-2 flex items-center gap-4">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex gap-4">
                      <DayBadges days={addr.daysAller} label="A" />
                      <DayBadges days={addr.daysRetour} label="R" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
                label: editingAddress.label ?? "",
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
                email: editingAddress.email ?? "",
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
              <strong>{deleteAddress?.label || `n°${deleteAddress?.position}`}</strong> ?
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
    label: "",
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
    email: "",
    observations: "",
    daysAller: [],
    daysRetour: [],
  };

  const form = useForm<UsagerAddressFormValues>({
    resolver: zodResolver(usagerAddressSchema),
    defaultValues: defaultValues ?? emptyValues,
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      form.reset(defaultValues ?? emptyValues);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter une adresse" : "Modifier l'adresse"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LABELS.map((l) => (
                          <SelectItem key={l.value} value={l.value} className="cursor-pointer">
                            {l.label}
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
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      <Input placeholder="01 23 45 67 89" {...field} />
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
                      <Input placeholder="06 12 34 56 78" {...field} />
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

            <DayPecGrid
              daysAller={form.watch("daysAller") ?? []}
              daysRetour={form.watch("daysRetour") ?? []}
              onChangeAller={(days) => form.setValue("daysAller", days)}
              onChangeRetour={(days) => form.setValue("daysRetour", days)}
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

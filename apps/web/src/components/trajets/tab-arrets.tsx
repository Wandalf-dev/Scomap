"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin, User, School } from "lucide-react";
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
  usagerFirstName: string | null;
  usagerLastName: string | null;
  usagerAddressLabel: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
}

interface TabArretsProps {
  trajetId: string;
}

export function TabArrets({ trajetId }: TabArretsProps) {
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

  // Check if an arret is the auto-created etablissement stop (orderIndex 0, type etablissement)
  function isAutoEtablissement(arret: ArretRow) {
    return arret.type === "etablissement" && arret.orderIndex === 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {!arretsList || arretsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun arret
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un premier arret pour ce trajet.
          </p>
        </div>
      ) : (
        <div className="rounded-[0.3rem] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead className="w-[60px]">Type</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Attente (min)</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {arretsList.map((arret) => (
                <TableRow key={arret.id}>
                  <TableCell className="text-muted-foreground">
                    {arret.orderIndex + 1}
                  </TableCell>
                  <TableCell>
                    {arret.type === "usager" ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : arret.type === "etablissement" ? (
                      <School className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="font-medium">{arret.name}</span>
                        {arret.type === "usager" && arret.usagerAddressLabel && (
                          <p className="text-sm text-muted-foreground">
                            {arret.usagerAddressLabel}
                          </p>
                        )}
                        {arret.type === "etablissement" &&
                          arret.etablissementCity && (
                            <p className="text-sm text-muted-foreground">
                              {arret.etablissementCity}
                            </p>
                          )}
                      </div>
                      {isAutoEtablissement(arret) && (
                        <Badge
                          variant="outline"
                          className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 text-xs"
                        >
                          Ecole
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[250px] truncate">
                    {arret.address || "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {arret.arrivalTime || "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {arret.waitTime ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    {!isAutoEtablissement(arret) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(arret)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteArret(arret)}
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
              ))}
            </TableBody>
          </Table>
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
                type: (editingArret.type as "usager" | "etablissement") ?? "usager",
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
            <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteArret && deleteMutation.mutate({ id: deleteArret.id, trajetId })}
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
      const type = (defaultValues?.type as "usager" | "etablissement") ?? "usager";
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 pt-2">
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
                variant={selectedType === "etablissement" ? "default" : "outline"}
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
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="\u2014"
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
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="\u2014"
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="orderIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordre</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                          field.onChange(v === "" ? undefined : parseInt(v, 10));
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

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { z } from "zod";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Route, Bell, ShieldCheck, Link, SquarePlus, ArrowLeft, AlertTriangle } from "lucide-react";
import { DayMiniGrid } from "@/components/shared/day-mini-grid";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import {
  isCircuitCompatibleTransport,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import type { DayEntry } from "@/lib/types/day-entry";

interface UsagerCircuitRow {
  id: string;
  circuitId: string;
  usagerAddressId: string | null;
  arrivalNotification: boolean;
  authorizationAlone: boolean;
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  circuitName: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  addressType: string | null;
  addressCity: string | null;
  addressAddress: string | null;
}

interface UsagerInfo {
  id: string;
  etablissementId: string | null;
  transportStartDate: string | null;
}

interface TabCircuitsProps {
  usagerId: string;
  usager: UsagerInfo;
}

export function TabCircuits({ usagerId, usager }: TabCircuitsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UsagerCircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsagerCircuitRow | null>(null);

  const { data: linkedCircuits, isLoading } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );

  const { data: allCircuits } = useQuery(trpc.circuits.list.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.circuits.list.queryKey(),
    });
  };

  const createMutation = useMutation(
    trpc.usagerCircuits.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit associé");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de l'association");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.usagerCircuits.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit modifié");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.usagerCircuits.delete.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit dissocié");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const createCircuitMutation = useMutation(
    trpc.circuits.createFull.mutationOptions({
      onError: () => {
        toast.error("Erreur lors de la création du circuit");
      },
    }),
  );

  function handleCreate() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function handleEdit(item: UsagerCircuitRow) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function getAddressLabel(type: string | null): string {
    if (!type) return "";
    return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
  }

  // Circuits already linked (to filter selector)
  const linkedCircuitIds = new Set(
    linkedCircuits?.map((lc) => lc.circuitId) ?? [],
  );
  const availableCircuits =
    allCircuits?.filter((c) => !linkedCircuitIds.has(c.id)) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Associer un circuit
        </Button>
      </div>

      {!linkedCircuits || linkedCircuits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Route className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun circuit
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Associez un circuit à cet usager pour définir ses jours de prise en
            charge.
          </p>
        </div>
      ) : (
        <div className="rounded-[0.3rem] border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Circuit</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Jours aller</TableHead>
                <TableHead>Jours retour</TableHead>
                <TableHead>Options</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedCircuits.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.circuitName}
                  </TableCell>
                  <TableCell>
                    {item.etablissementName ? (
                      <span>
                        {item.etablissementName}
                        {item.etablissementCity && (
                          <span className="text-muted-foreground ml-1">
                            ({item.etablissementCity})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.addressType ? (
                      <span className="text-sm">
                        {getAddressLabel(item.addressType)}
                        {item.addressCity && (
                          <span className="text-muted-foreground ml-1">
                            ({item.addressCity})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DayMiniGrid days={item.daysAller} color="orange" />
                  </TableCell>
                  <TableCell>
                    <DayMiniGrid days={item.daysRetour} color="blue" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {item.arrivalNotification && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Bell className="h-3 w-3" />
                          Notif
                        </Badge>
                      )}
                      {item.authorizationAlone && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Seul
                        </Badge>
                      )}
                      {!item.arrivalNotification && !item.authorizationAlone && (
                        <span className="text-muted-foreground/60">&mdash;</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <CircuitLinkDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        onSubmitCreate={(values) => {
          createMutation.mutate({
            usagerId,
            circuitId: values.circuitId,
            usagerAddressId: values.usagerAddressId,
            arrivalNotification: values.arrivalNotification,
            authorizationAlone: values.authorizationAlone,
          });
        }}
        onSubmitCreateNew={async (values) => {
          const circuit = await createCircuitMutation.mutateAsync({
            name: values.circuitName,
            etablissementId: values.etablissementId,
            startDate: usager.transportStartDate || null,
          });
          createMutation.mutate({
            usagerId,
            circuitId: circuit.id,
            usagerAddressId: values.usagerAddressId,
            arrivalNotification: values.arrivalNotification,
            authorizationAlone: values.authorizationAlone,
          });
        }}
        onSubmitUpdate={(values) => {
          if (editingItem) {
            updateMutation.mutate({
              id: editingItem.id,
              data: {
                usagerAddressId: values.usagerAddressId,
                arrivalNotification: values.arrivalNotification,
                authorizationAlone: values.authorizationAlone,
              },
            });
          }
        }}
        usagerId={usagerId}
        usager={usager}
        availableCircuits={availableCircuits}
        editingItem={editingItem}
        isPending={createMutation.isPending || updateMutation.isPending || createCircuitMutation.isPending}
      />

      {/* Delete Dialog */}
      <DissociateDialog
        deleteItem={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate({ id: deleteItem.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// --- Dissociate Dialog ---

function DissociateDialog({
  deleteItem,
  onClose,
  onConfirm,
  isPending,
}: {
  deleteItem: UsagerCircuitRow | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const trpc = useTRPC();

  const { data: usagerCount } = useQuery({
    ...trpc.usagerCircuits.countByCircuit.queryOptions({
      circuitId: deleteItem?.circuitId ?? "",
    }),
    enabled: !!deleteItem,
  });

  const willBeEmpty = usagerCount !== undefined && usagerCount <= 1;

  return (
    <AlertDialog
      open={!!deleteItem}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dissocier le circuit</AlertDialogTitle>
          <AlertDialogDescription>
            Retirer l&apos;usager du circuit{" "}
            <strong>{deleteItem?.circuitName}</strong> ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {willBeEmpty && (
          <div className="flex gap-3 rounded-[0.3rem] border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm text-foreground">
              Cet usager est le dernier sur le circuit <strong>{deleteItem?.circuitName}</strong>. Le dissocier rendra le circuit inactif. Vous pourrez le retrouver dans la liste des circuits.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isPending}
            className="cursor-pointer"
          >
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Suppression..." : "Dissocier"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Schemas ---

const linkFormSchema = z.object({
  circuitId: z.string().uuid("Sélectionnez un circuit"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

const createNewFormSchema = z.object({
  circuitName: z.string().min(1, "Nom du circuit requis"),
  etablissementId: z.string().uuid("Sélectionnez un établissement"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});

type CreateNewFormValues = z.infer<typeof createNewFormSchema>;

// --- Dialog modes ---

type DialogMode = "choose" | "existing" | "new";

interface CircuitLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (values: LinkFormValues) => void;
  onSubmitCreateNew: (values: CreateNewFormValues) => void;
  onSubmitUpdate: (values: LinkFormValues) => void;
  usagerId: string;
  usager: UsagerInfo;
  availableCircuits: { id: string; name: string; etablissementName: string | null }[];
  editingItem: UsagerCircuitRow | null;
  isPending: boolean;
}

function CircuitLinkDialog({
  open,
  onOpenChange,
  onSubmitCreate,
  onSubmitCreateNew,
  onSubmitUpdate,
  usagerId,
  usager,
  availableCircuits,
  editingItem,
  isPending,
}: CircuitLinkDialogProps) {
  const trpc = useTRPC();
  const isEdit = !!editingItem;
  const [mode, setMode] = useState<DialogMode>("choose");

  const linkForm = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      circuitId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });

  const createForm = useForm<CreateNewFormValues>({
    resolver: zodResolver(createNewFormSchema),
    defaultValues: {
      circuitName: "",
      etablissementId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });

  const { data: usagerAddresses } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  // Sync mode + form values when dialog opens or editingItem changes
  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setMode("existing");
      linkForm.reset({
        circuitId: editingItem.circuitId,
        usagerAddressId: editingItem.usagerAddressId ?? "",
        arrivalNotification: editingItem.arrivalNotification,
        authorizationAlone: editingItem.authorizationAlone,
      });
    } else {
      setMode("choose");
      linkForm.reset({
        circuitId: "",
        usagerAddressId: "",
        arrivalNotification: false,
        authorizationAlone: false,
      });
      createForm.reset({
        circuitName: "",
        etablissementId: usager.etablissementId ?? "",
        usagerAddressId: "",
        arrivalNotification: false,
        authorizationAlone: false,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingItem]);

  function getAddressTypeLabel(type: string | null): string {
    if (!type) return "";
    return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
  }

  const dialogTitle = isEdit
    ? "Modifier l'association"
    : mode === "choose"
      ? "Associer un circuit"
      : mode === "existing"
        ? "Associer un circuit existant"
        : "Créer et associer un nouveau circuit";

  // Only addresses with circuit-compatible transport types
  const circuitCompatibleAddresses = usagerAddresses?.filter((addr) =>
    isCircuitCompatibleTransport(addr.transportType),
  ) ?? [];

  // Shared address + options fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function AddressAndOptions({ control }: { control: any }) {
    return (
      <>
        <FormField
          control={control}
          name="usagerAddressId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse de prise en charge</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ""}
              >
                <FormControl>
                  <SelectTrigger className="w-full cursor-pointer">
                    <SelectValue placeholder="Sélectionnez une adresse" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {circuitCompatibleAddresses.map((addr) => (
                    <SelectItem
                      key={addr.id}
                      value={addr.id}
                      className="cursor-pointer"
                    >
                      {getAddressTypeLabel(addr.type) || `Adresse ${addr.position}`}
                      {addr.address && ` — ${addr.address}`}
                      {addr.city && `, ${addr.city}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usagerAddresses && usagerAddresses.length > 0 && circuitCompatibleAddresses.length === 0 && (
                <p className="text-sm text-destructive">
                  Aucune adresse compatible avec un circuit. Les types {usagerAddresses.map((a) => USAGER_TRANSPORT_TYPE_LABELS[a.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS]).filter(Boolean).join(", ")} ne nécessitent pas de circuit.
                </p>
              )}
              {usagerAddresses && circuitCompatibleAddresses.length < usagerAddresses.length && circuitCompatibleAddresses.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {usagerAddresses.length - circuitCompatibleAddresses.length} adresse(s) masquée(s) (type de transport incompatible)
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 rounded-[0.3rem] border p-4">
          <FormField
            control={control}
            name="arrivalNotification"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Notification d&apos;arrivée</FormLabel>
                  <FormDescription>
                    Envoyer une notification à l&apos;arrivée du véhicule
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="cursor-pointer"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="authorizationAlone"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Autorisation de rentrer seul</FormLabel>
                  <FormDescription>
                    L&apos;usager est autorisé à rentrer seul à son domicile
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="cursor-pointer"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose mode */}
        {mode === "choose" && !isEdit && (
          <div className="grid gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className="cursor-pointer flex items-start gap-4 rounded-[0.3rem] border p-4 text-left transition-colors hover:bg-accent/50"
            >
              <Link className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Associer un circuit existant</p>
                <p className="text-sm text-muted-foreground">
                  Ajouter cet usager sur un circuit déjà créé
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className="cursor-pointer flex items-start gap-4 rounded-[0.3rem] border p-4 text-left transition-colors hover:bg-accent/50"
            >
              <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Créer un nouveau circuit</p>
                <p className="text-sm text-muted-foreground">
                  Créer un circuit dédié et l&apos;associer automatiquement
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Mode: Associate existing circuit */}
        {mode === "existing" && (
          <Form {...linkForm}>
            <form
              onSubmit={linkForm.handleSubmit((values) => {
                if (isEdit) onSubmitUpdate(values);
                else onSubmitCreate(values);
              })}
              className="grid gap-4 pt-2"
            >
              {!isEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("choose")}
                    className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour
                  </button>
                  <FormField
                    control={linkForm.control}
                    name="circuitId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Circuit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full cursor-pointer">
                              <SelectValue placeholder="Sélectionnez un circuit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableCircuits.map((c) => (
                              <SelectItem
                                key={c.id}
                                value={c.id}
                                className="cursor-pointer"
                              >
                                {c.name}
                                {c.etablissementName && ` — ${c.etablissementName}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {isEdit && (
                <p className="text-sm text-muted-foreground">
                  Circuit : <strong>{editingItem.circuitName}</strong>
                </p>
              )}

              <AddressAndOptions control={linkForm.control} />

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
                    : isEdit
                      ? "Enregistrer"
                      : "Associer"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Mode: Create new circuit */}
        {mode === "new" && !isEdit && (
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(onSubmitCreateNew)}
              className="grid gap-4 pt-2"
            >
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </button>

              <FormField
                control={createForm.control}
                name="circuitName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du circuit</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Circuit École Pasteur - Matin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="etablissementId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Établissement</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionnez un établissement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {etablissements?.map((e) => (
                          <SelectItem
                            key={e.id}
                            value={e.id}
                            className="cursor-pointer"
                          >
                            {e.name}
                            {e.city && ` — ${e.city}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AddressAndOptions control={createForm.control} />

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
                  {isPending ? "Création..." : "Créer et associer"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

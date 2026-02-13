"use client";

import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { DayBadges } from "@/components/shared/day-badges";
import type { DayEntry } from "@/lib/types/day-entry";

interface UsagerCircuitRow {
  id: string;
  usagerId: string;
  usagerAddressId: string | null;
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  usagerFirstName: string;
  usagerLastName: string;
  usagerCode: string | null;
  addressType: string | null;
  addressCity: string | null;
  addressAddress: string | null;
}

interface TabUsagersProps {
  circuitId: string;
}

export function TabUsagers({ circuitId }: TabUsagersProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UsagerCircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsagerCircuitRow | null>(null);

  const { data: linkedUsagers, isLoading } = useQuery(
    trpc.usagerCircuits.listByCircuit.queryOptions({ circuitId }),
  );

  const { data: allUsagers } = useQuery(trpc.usagers.list.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByCircuit.queryKey({ circuitId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listByCircuit.queryKey({ circuitId }),
    });
  };

  const createMutation = useMutation(
    trpc.usagerCircuits.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Usager associe");
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
        toast.success("Jours de PEC modifies");
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
        toast.success("Usager dissocie");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
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

  const linkedUsagerIds = new Set(
    linkedUsagers?.map((lu) => lu.usagerId) ?? [],
  );
  const availableUsagers =
    allUsagers?.filter((u) => !linkedUsagerIds.has(u.id)) ?? [];

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
          Associer un usager
        </Button>
      </div>

      {!linkedUsagers || linkedUsagers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun usager
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Associez des usagers a ce circuit pour definir leurs jours de prise
            en charge.
          </p>
        </div>
      ) : (
        <div className="rounded-[0.3rem] border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prenom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Jours aller</TableHead>
                <TableHead>Jours retour</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedUsagers.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.usagerCode ?? (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.usagerLastName}
                  </TableCell>
                  <TableCell>{item.usagerFirstName}</TableCell>
                  <TableCell>
                    {item.addressType ? (
                      <span className="text-sm">
                        {item.addressType}
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
                    <DayBadges days={item.daysAller} label="A" />
                  </TableCell>
                  <TableCell>
                    <DayBadges days={item.daysRetour} label="R" />
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
      <UsagerLinkDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        onSubmitCreate={(values) => {
          createMutation.mutate({
            usagerId: values.usagerId,
            circuitId,
            usagerAddressId: values.usagerAddressId,
          });
        }}
        onSubmitUpdate={(values) => {
          if (editingItem) {
            updateMutation.mutate({
              id: editingItem.id,
              data: {
                usagerAddressId: values.usagerAddressId,
              },
            });
          }
        }}
        availableUsagers={availableUsagers}
        editingItem={editingItem}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dissocier l&apos;usager</AlertDialogTitle>
            <AlertDialogDescription>
              Retirer{" "}
              <strong>
                {deleteItem?.usagerFirstName} {deleteItem?.usagerLastName}
              </strong>{" "}
              de ce circuit ?
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
                deleteItem && deleteMutation.mutate({ id: deleteItem.id })
              }
              disabled={deleteMutation.isPending}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Dissocier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Usager Link Dialog ---

const linkFormSchema = z.object({
  usagerId: z.string().uuid("Selectionnez un usager"),
  usagerAddressId: z.string().uuid("Selectionnez une adresse"),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

interface UsagerLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (values: LinkFormValues) => void;
  onSubmitUpdate: (values: LinkFormValues) => void;
  availableUsagers: {
    id: string;
    firstName: string;
    lastName: string;
    code: string | null;
  }[];
  editingItem: UsagerCircuitRow | null;
  isPending: boolean;
}

function UsagerLinkDialog({
  open,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
  availableUsagers,
  editingItem,
  isPending,
}: UsagerLinkDialogProps) {
  const trpc = useTRPC();
  const isEdit = !!editingItem;

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      usagerId: "",
      usagerAddressId: "",
    },
  });

  const selectedUsagerId = form.watch("usagerId");
  const usagerIdForAddresses = isEdit
    ? editingItem.usagerId
    : selectedUsagerId || undefined;

  const { data: usagerAddresses } = useQuery({
    ...trpc.usagerAddresses.list.queryOptions({
      usagerId: usagerIdForAddresses!,
    }),
    enabled: !!usagerIdForAddresses,
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      if (editingItem) {
        form.reset({
          usagerId: editingItem.usagerId,
          usagerAddressId: editingItem.usagerAddressId ?? "",
        });
      } else {
        form.reset({
          usagerId: "",
          usagerAddressId: "",
        });
      }
    }
    onOpenChange(open);
  };

  function onSubmit(values: LinkFormValues) {
    if (isEdit) {
      onSubmitUpdate(values);
    } else {
      onSubmitCreate(values);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier les jours de PEC" : "Associer un usager"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
            {!isEdit && (
              <FormField
                control={form.control}
                name="usagerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usager</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("usagerAddressId", "");
                      }}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Selectionnez un usager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableUsagers.map((u) => (
                          <SelectItem
                            key={u.id}
                            value={u.id}
                            className="cursor-pointer"
                          >
                            {u.lastName} {u.firstName}
                            {u.code && ` (${u.code})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEdit && (
              <p className="text-sm text-muted-foreground">
                Usager :{" "}
                <strong>
                  {editingItem.usagerFirstName} {editingItem.usagerLastName}
                </strong>
              </p>
            )}

            {/* Address selector */}
            {usagerIdForAddresses && (
              <FormField
                control={form.control}
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
                          <SelectValue placeholder="Selectionnez une adresse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {usagerAddresses?.map((addr) => (
                          <SelectItem
                            key={addr.id}
                            value={addr.id}
                            className="cursor-pointer"
                          >
                            {addr.type ?? `Adresse ${addr.position}`}
                            {addr.address && ` — ${addr.address}`}
                            {addr.city && `, ${addr.city}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                  : isEdit
                    ? "Enregistrer"
                    : "Associer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


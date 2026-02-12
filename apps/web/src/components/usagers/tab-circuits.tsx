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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Route } from "lucide-react";

const DAY_LABELS: Record<number, string> = {
  1: "L",
  2: "M",
  3: "Me",
  4: "J",
  5: "V",
  6: "S",
  7: "D",
};

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function DayBadges({ days, label }: { days: number[] | null; label: string }) {
  if (!days || days.length === 0) {
    return <span className="text-muted-foreground/60">&mdash;</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {ALL_DAYS.map((d) => (
          <Badge
            key={d}
            variant={days.includes(d) ? "default" : "outline"}
            className={`h-5 w-6 justify-center px-0 text-[10px] ${
              days.includes(d)
                ? ""
                : "text-muted-foreground/40 border-border/50"
            }`}
          >
            {DAY_LABELS[d]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface UsagerCircuitRow {
  id: string;
  circuitId: string;
  usagerAddressId: string | null;
  daysAller: number[] | null;
  daysRetour: number[] | null;
  circuitName: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  addressLabel: string | null;
  addressCity: string | null;
  addressAddress: string | null;
}

interface TabCircuitsProps {
  usagerId: string;
}

export function TabCircuits({ usagerId }: TabCircuitsProps) {
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
  };

  const createMutation = useMutation(
    trpc.usagerCircuits.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit associe");
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
        toast.success("Circuit dissocie");
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
            Associez un circuit a cet usager pour definir ses jours de prise en
            charge.
          </p>
        </div>
      ) : (
        <div className="rounded-[0.3rem] border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Circuit</TableHead>
                <TableHead>Etablissement</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Jours aller</TableHead>
                <TableHead>Jours retour</TableHead>
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
                    {item.addressLabel ? (
                      <span className="text-sm">
                        {item.addressLabel}
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
            daysAller: values.daysAller,
            daysRetour: values.daysRetour,
          });
        }}
        onSubmitUpdate={(values) => {
          if (editingItem) {
            updateMutation.mutate({
              id: editingItem.id,
              data: {
                usagerAddressId: values.usagerAddressId,
                daysAller: values.daysAller,
                daysRetour: values.daysRetour,
              },
            });
          }
        }}
        usagerId={usagerId}
        availableCircuits={availableCircuits}
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
            <AlertDialogTitle>Dissocier le circuit</AlertDialogTitle>
            <AlertDialogDescription>
              Retirer l&apos;usager du circuit{" "}
              <strong>{deleteItem?.circuitName}</strong> ?
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

// --- Circuit Link Dialog ---

const linkFormSchema = z.object({
  circuitId: z.string().uuid("Selectionnez un circuit"),
  usagerAddressId: z.string().uuid("Selectionnez une adresse"),
  daysAller: z.array(z.number()),
  daysRetour: z.array(z.number()),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

interface CircuitLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (values: LinkFormValues) => void;
  onSubmitUpdate: (values: LinkFormValues) => void;
  usagerId: string;
  availableCircuits: { id: string; name: string; etablissementName: string | null }[];
  editingItem: UsagerCircuitRow | null;
  isPending: boolean;
}

function CircuitLinkDialog({
  open,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
  usagerId,
  availableCircuits,
  editingItem,
  isPending,
}: CircuitLinkDialogProps) {
  const trpc = useTRPC();
  const isEdit = !!editingItem;

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      circuitId: "",
      usagerAddressId: "",
      daysAller: [],
      daysRetour: [],
    },
  });

  const { data: usagerAddresses } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

  const handleOpenChange = (open: boolean) => {
    if (open) {
      if (editingItem) {
        form.reset({
          circuitId: editingItem.circuitId,
          usagerAddressId: editingItem.usagerAddressId ?? "",
          daysAller: (editingItem.daysAller as number[]) ?? [],
          daysRetour: (editingItem.daysRetour as number[]) ?? [],
        });
      } else {
        form.reset({
          circuitId: "",
          usagerAddressId: "",
          daysAller: [],
          daysRetour: [],
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
            {isEdit ? "Modifier les jours de PEC" : "Associer un circuit"}
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
                          <SelectValue placeholder="Selectionnez un circuit" />
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
            )}

            {isEdit && (
              <p className="text-sm text-muted-foreground">
                Circuit : <strong>{editingItem.circuitName}</strong>
              </p>
            )}

            {/* Address selector */}
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
                          {addr.label ?? `Adresse ${addr.position}`}
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

            <DaysCheckboxGroup
              form={form}
              name="daysAller"
              label="Jours aller"
            />
            <DaysCheckboxGroup
              form={form}
              name="daysRetour"
              label="Jours retour"
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

// --- Days Checkbox Group ---

function DaysCheckboxGroup({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<LinkFormValues>>;
  name: "daysAller" | "daysRetour";
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>{label}</FormLabel>
            <button
              type="button"
              className="cursor-pointer text-xs text-primary hover:underline"
              onClick={() => {
                const current = field.value ?? [];
                if (current.length === ALL_DAYS.length) {
                  field.onChange([]);
                } else {
                  field.onChange([...ALL_DAYS]);
                }
              }}
            >
              {(field.value ?? []).length === ALL_DAYS.length ? "Aucun" : "Tous"}
            </button>
          </div>
          <div className="flex gap-3">
            {ALL_DAYS.map((day) => {
              const checked = (field.value ?? []).includes(day);
              return (
                <label
                  key={day}
                  className="flex cursor-pointer flex-col items-center gap-1.5"
                >
                  <Checkbox
                    checked={checked}
                    className="h-6 w-6 cursor-pointer"
                    onCheckedChange={(isChecked) => {
                      const current = field.value ?? [];
                      if (isChecked) {
                        field.onChange([...current, day].sort());
                      } else {
                        field.onChange(current.filter((d) => d !== day));
                      }
                    }}
                  />
                  <span className="cursor-pointer text-xs text-muted-foreground">
                    {DAY_LABELS[day]}
                  </span>
                </label>
              );
            })}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

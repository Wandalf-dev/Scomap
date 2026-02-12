"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  vehiculeSchema,
  type VehiculeFormValues,
} from "@/lib/validators/vehicule";

interface VehiculeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VehiculeFormValues) => void;
  defaultValues?: VehiculeFormValues;
  isPending: boolean;
  mode: "create" | "edit";
}

export function VehiculeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  mode,
}: VehiculeFormDialogProps) {
  const form = useForm<VehiculeFormValues>({
    resolver: zodResolver(vehiculeSchema),
    defaultValues: defaultValues ?? {
      name: "",
      licensePlate: "",
      capacity: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        defaultValues ?? {
          name: "",
          licensePlate: "",
          capacity: "",
        },
      );
    }
  }, [open, defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Ajouter un vehicule"
              : "Modifier le vehicule"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du vehicule" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licensePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Immatriculation</FormLabel>
                    <FormControl>
                      <Input placeholder="AA-123-BB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacite</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Nombre de places"
                        {...field}
                        value={field.value ?? ""}
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

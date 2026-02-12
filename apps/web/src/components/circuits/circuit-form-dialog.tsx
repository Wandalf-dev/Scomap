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
  circuitSchema,
  type CircuitFormValues,
} from "@/lib/validators/circuit";

interface CircuitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CircuitFormValues) => void;
  defaultValues?: CircuitFormValues;
  isPending: boolean;
  mode: "create" | "edit";
}

export function CircuitFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  mode,
}: CircuitFormDialogProps) {
  const form = useForm<CircuitFormValues>({
    resolver: zodResolver(circuitSchema),
    defaultValues: defaultValues ?? { name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues ?? { name: "" });
    }
  }, [open, defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Ajouter un circuit"
              : "Modifier le circuit"}
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
                    <Input placeholder="Nom du circuit" {...field} />
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

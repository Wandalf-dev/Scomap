"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { RotateCcw } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChauffeurSelector } from "./chauffeur-selector";
import { VehiculeSelector } from "./vehicule-selector";
import {
  occurrenceOverrideSchema,
  type OccurrenceOverrideFormValues,
} from "@/lib/validators/trajet";

interface OccurrenceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OccurrenceOverrideFormValues) => void;
  defaultValues?: OccurrenceOverrideFormValues;
  isPending: boolean;
  occurrenceDate: string;
  /** Masque le champ statut (géré par ailleurs dans le planning). */
  hideStatus?: boolean;
  /** Si fourni, affiche « Réinitialiser » : remet tous les overrides à null. */
  onReset?: () => void;
}

export function OccurrenceEditDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  occurrenceDate,
  hideStatus,
  onReset,
}: OccurrenceEditDialogProps) {
  const defaults: OccurrenceOverrideFormValues = defaultValues ?? {
    chauffeurId: null,
    vehiculeId: null,
    departureTime: null,
    status: "planifie",
    notes: null,
  };

  const form = useForm<OccurrenceOverrideFormValues>({
    resolver: zodResolver(occurrenceOverrideSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            Modifier l&apos;occurrence du {occurrenceDate}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
            {!hideStatus && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "planifie"}
                    >
                      <FormControl>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planifie" className="cursor-pointer">
                          Planifié
                        </SelectItem>
                        <SelectItem value="en_cours" className="cursor-pointer">
                          En cours
                        </SelectItem>
                        <SelectItem value="termine" className="cursor-pointer">
                          Terminé
                        </SelectItem>
                        <SelectItem value="annule" className="cursor-pointer">
                          Annulé
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="chauffeurId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chauffeur (override)</FormLabel>
                  <FormControl>
                    <ChauffeurSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehiculeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Véhicule (override)</FormLabel>
                  <FormControl>
                    <VehiculeSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departureTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure de départ (override)</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes pour cette occurrence..."
                      rows={3}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              {onReset && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReset}
                  disabled={isPending}
                  className="mr-auto cursor-pointer text-amber-700 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Réinitialiser
                </Button>
              )}
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
                {isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

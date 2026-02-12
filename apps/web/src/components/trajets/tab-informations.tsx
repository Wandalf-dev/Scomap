"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  trajetDetailSchema,
  type TrajetDetailFormValues,
} from "@/lib/validators/trajet";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CircuitSelector } from "./circuit-selector";
import { ChauffeurSelector } from "./chauffeur-selector";
import { VehiculeSelector } from "./vehicule-selector";
import { RecurrenceInput } from "./recurrence-input";

interface TrajetData {
  id: string;
  name: string;
  direction: string;
  departureTime: string | null;
  recurrence: { frequency: string; daysOfWeek: number[] } | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  circuitId: string;
  chauffeurId: string | null;
  vehiculeId: string | null;
}

interface TabInformationsProps {
  trajet: TrajetData;
}

export function TabInformations({ trajet }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<TrajetDetailFormValues>({
    resolver: zodResolver(trajetDetailSchema),
    defaultValues: {
      name: trajet.name,
      circuitId: trajet.circuitId,
      direction: trajet.direction as "aller" | "retour",
      chauffeurId: trajet.chauffeurId ?? null,
      vehiculeId: trajet.vehiculeId ?? null,
      departureTime: trajet.departureTime ?? "",
      recurrence: trajet.recurrence
        ? {
            frequency: "weekly" as const,
            daysOfWeek: trajet.recurrence.daysOfWeek,
          }
        : { frequency: "weekly" as const, daysOfWeek: [] },
      startDate: trajet.startDate,
      endDate: trajet.endDate ?? null,
      notes: trajet.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.trajets.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.getById.queryKey({ id: trajet.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet enregistre");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: TrajetDetailFormValues) {
    const recurrence = values.recurrence?.daysOfWeek?.length
      ? values.recurrence
      : null;
    mutation.mutate({ id: trajet.id, data: { ...values, recurrence } });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du trajet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="circuitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Circuit</FormLabel>
                  <FormControl>
                    <CircuitSelector
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
              name="direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direction</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="aller" className="cursor-pointer">
                        Aller
                      </SelectItem>
                      <SelectItem value="retour" className="cursor-pointer">
                        Retour
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departureTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure de depart</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Planification */}
        <Card>
          <CardHeader>
            <CardTitle>Planification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="recurrence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jours de recurrence</FormLabel>
                  <FormControl>
                    <RecurrenceInput
                      value={field.value?.daysOfWeek ?? []}
                      onChange={(days) =>
                        field.onChange({
                          frequency: "weekly" as const,
                          daysOfWeek: days,
                        })
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de debut</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
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
            </div>
          </CardContent>
        </Card>

        {/* Affectation */}
        <Card>
          <CardHeader>
            <CardTitle>Affectation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="chauffeurId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chauffeur</FormLabel>
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
                  <FormLabel>Vehicule</FormLabel>
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
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Notes sur le trajet..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

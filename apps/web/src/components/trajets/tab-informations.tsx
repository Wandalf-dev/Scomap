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
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CircuitSelector } from "./circuit-selector";
import { ChauffeurSelector } from "./chauffeur-selector";
import { VehiculeSelector } from "./vehicule-selector";
import { DaySelector } from "@/components/shared/day-selector";
import { formatDaysShort, normalizeDays, type DayEntry } from "@/lib/types/day-entry";

interface TrajetData {
  id: string;
  name: string;
  direction: string;
  departureTime: string | null;
  recurrence: { frequency: string; daysOfWeek: DayEntry[] } | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  circuitId: string;
  chauffeurId: string | null;
  vehiculeId: string | null;
  peages: boolean;
  kmACharge: number | null;
}

interface TabInformationsProps {
  trajet: TrajetData;
  circuitStartDate: string | null;
  circuitEndDate: string | null;
  circuitOperatingDays: DayEntry[] | null;
}

export function TabInformations({ trajet, circuitStartDate, circuitEndDate, circuitOperatingDays }: TabInformationsProps) {
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
      startDate: trajet.startDate ?? null,
      endDate: trajet.endDate ?? null,
      notes: trajet.notes ?? "",
      peages: trajet.peages,
      kmACharge: trajet.kmACharge ?? null,
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
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Row 1: Identification */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intitule du trajet</FormLabel>
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
            </div>

            {/* Row 2: Planification */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jours</FormLabel>
                      <FormControl>
                        <DaySelector
                          value={field.value?.daysOfWeek ?? []}
                          onChange={(days) =>
                            field.onChange({
                              frequency: "weekly" as const,
                              daysOfWeek: days,
                            })
                          }
                        />
                      </FormControl>
                      {circuitOperatingDays && circuitOperatingDays.length > 0 && (!field.value?.daysOfWeek || field.value.daysOfWeek.length === 0) && (
                        <p className="text-xs text-muted-foreground">
                          Herite du circuit : {formatDaysShort(normalizeDays(circuitOperatingDays))}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de debut</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                      />
                    </FormControl>
                    {circuitStartDate && !field.value && (
                      <p className="text-xs text-muted-foreground">
                        Herite du circuit : {circuitStartDate}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                      />
                    </FormControl>
                    {circuitEndDate && !field.value && (
                      <p className="text-xs text-muted-foreground">
                        Herite du circuit : {circuitEndDate}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Affectation + options */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

              <FormField
                control={form.control}
                name="peages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peages</FormLabel>
                    <div className="flex items-center gap-2 h-9">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="cursor-pointer"
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">
                        {field.value ? "Oui" : "Non"}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kmACharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Km a charge</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? null : parseFloat(v));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observations sur le trajet..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
      </CardContent>
    </Card>
  );
}

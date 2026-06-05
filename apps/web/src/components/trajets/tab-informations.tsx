"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CircuitSelector } from "./circuit-selector";
import { ChauffeurSelector } from "./chauffeur-selector";
import { VehiculeSelector } from "./vehicule-selector";
import { DayBadges } from "@/components/shared/day-badges";
import { Lock } from "lucide-react";
import type { DayEntry } from "@/lib/types/day-entry";

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
}

export function TabInformations({ trajet, circuitStartDate, circuitEndDate }: TabInformationsProps) {
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
      startDate: trajet.startDate ?? circuitStartDate ?? null,
      endDate: trajet.endDate ?? circuitEndDate ?? null,
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
    // Keep inheritance: if the field still shows the circuit's date and the
    // trajet had no own date, persist null so it keeps following the circuit.
    const startDate =
      !trajet.startDate && values.startDate === circuitStartDate
        ? null
        : values.startDate;
    const endDate =
      !trajet.endDate && values.endDate === circuitEndDate
        ? null
        : values.endDate;
    mutation.mutate({
      id: trajet.id,
      data: { ...values, recurrence, startDate, endDate },
    });
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
                    <FormLabel className="flex items-center gap-1.5">
                      Intitule du trajet
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du trajet" {...field} disabled />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Genere automatiquement (sens + jours).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="circuitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Circuit
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    </FormLabel>
                    <FormControl>
                      <CircuitSelector
                        value={field.value}
                        onChange={field.onChange}
                        disabled
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Circuit de rattachement du trajet.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Direction
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled
                    >
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
                    <p className="text-xs text-muted-foreground">
                      Sens du trajet (structure des arrets).
                    </p>
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
                    <p className="text-xs text-muted-foreground">
                      Heure de reference a l&apos;ecole (arrivee si aller, depart
                      si retour) : sert d&apos;ancre au calcul des horaires.
                    </p>
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
                      <FormLabel className="flex items-center gap-1.5">
                        Jours
                        <Lock className="h-3 w-3 text-muted-foreground/60" />
                      </FormLabel>
                      <div className="flex min-h-9 items-center">
                        <DayBadges days={field.value?.daysOfWeek ?? null} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Suit les jours de PEC des usagers &mdash; modifiable via
                        un avenant.
                      </p>
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
                    <FormLabel className="flex items-center gap-1.5">
                      Date de debut
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    </FormLabel>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      disabled
                    />
                    {circuitStartDate &&
                    !trajet.startDate &&
                    field.value === circuitStartDate ? (
                      <p className="text-xs text-muted-foreground">
                        Herite du circuit.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Date de fin
                      <Lock className="h-3 w-3 text-muted-foreground/60" />
                    </FormLabel>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      disabled
                    />
                    {circuitEndDate &&
                    !trajet.endDate &&
                    field.value === circuitEndDate ? (
                      <p className="text-xs text-muted-foreground">
                        Herite du circuit.
                      </p>
                    ) : null}
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

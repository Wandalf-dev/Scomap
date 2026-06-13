"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parse } from "date-fns";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ChauffeurSelector } from "./chauffeur-selector";
import { VehiculeSelector } from "./vehicule-selector";
import { DayBadges } from "@/components/shared/day-badges";
import { DirectionBadge } from "@/components/shared/direction-badge";
import {
  CalendarDays,
  ExternalLink,
  Lock,
  MoveRight,
  Route,
} from "lucide-react";
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
  circuitName: string | null;
  etablissementName: string | null;
  circuitStartDate: string | null;
  circuitEndDate: string | null;
}

// ISO (yyyy-MM-dd) -> "dd/mm/yyyy" for the recap strip.
function formatDateFr(iso: string | null): string | null {
  if (!iso) return null;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? format(d, "dd/MM/yyyy") : iso;
}

function RecapItem({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex min-h-5 items-center text-sm">{children}</div>
    </div>
  );
}

export function TabInformations({
  trajet,
  circuitName,
  etablissementName,
  circuitStartDate,
  circuitEndDate,
}: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const formId = "trajet-informations-form";

  const form = useForm<TrajetDetailFormValues>({
    resolver: zodResolver(trajetDetailSchema),
    // Locked fields (name, circuitId, direction, recurrence, dates) are kept
    // in the form state so the update payload stays complete — they are
    // displayed in the recap strip, not as inputs.
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
        toast.success("Trajet enregistré");
        // Reset the form to pristine with the displayed values
        // (not the transformed values sent to the server).
        form.reset(form.getValues());
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
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

  // Sync the form dirty state with the layout context.
  // We depend on `setDirty` (stable) rather than the full `unsaved` object to
  // avoid a re-trigger loop (cf. tab-identite for usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("trajet-informations", isDirty);
    return () => setDirty?.("trajet-informations", false);
  }, [isDirty, setDirty]);

  const startLabel = formatDateFr(trajet.startDate ?? circuitStartDate);
  const endLabel = formatDateFr(trajet.endDate ?? circuitEndDate);
  const periodInherited =
    (!trajet.startDate && !!circuitStartDate) ||
    (!trajet.endDate && !!circuitEndDate);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {headerActions?.target &&
        createPortal(
          <Button
            type="submit"
            form={formId}
            size="sm"
            disabled={mutation.isPending || !form.formState.isDirty}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>,
          headerActions.target,
        )}

      {/* Derived identity of the trajet — read-only, changes go through avenants */}
      <div className="border-b border-border bg-gradient-to-r from-primary/[0.08] to-transparent px-6 py-4">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          <RecapItem label="Circuit" hint="Circuit de rattachement du trajet.">
            {circuitName ? (
              <Link
                href={`/circuits/${trajet.circuitId}`}
                className="group inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium text-foreground transition-colors hover:text-primary"
              >
                <Route className="size-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" />
                <span>{circuitName}</span>
                {etablissementName && (
                  <span className="font-normal text-muted-foreground">
                    — {etablissementName}
                  </span>
                )}
                <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" />
              </Link>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </RecapItem>

          <RecapItem
            label="Direction"
            hint="Sens du trajet (structure des arrêts)."
          >
            <DirectionBadge direction={trajet.direction} />
          </RecapItem>

          <RecapItem
            label="Jours"
            hint="Suivent les jours de PEC des usagers."
          >
            <DayBadges days={trajet.recurrence?.daysOfWeek ?? null} />
          </RecapItem>

          <RecapItem
            label="Période"
            hint={periodInherited ? "Héritée du circuit." : undefined}
          >
            {startLabel || endLabel ? (
              <span className="flex flex-wrap items-center gap-1.5 font-medium tabular-nums">
                <CalendarDays className="size-3.5 shrink-0 text-muted-foreground/70" />
                {startLabel ?? "…"}
                <MoveRight className="size-3.5 text-muted-foreground/50" />
                {endLabel ?? "…"}
                {periodInherited && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · héritée du circuit
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </RecapItem>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="size-3 shrink-0" />
          Intitulé, jours et période sont dérivés des usagers et du circuit —
          modifiables via un avenant.
        </p>
      </div>

      <CardContent className="py-6">
        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Row 1: Exploitation. items-start: columns keep their natural
                height so labels/inputs stay top-aligned even when a sibling
                column is taller (helper text). */}
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="departureTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de départ</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Heure de référence à l&apos;école (arrivée si aller, départ
                      si retour) : sert d&apos;ancre au calcul des horaires.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormLabel>Véhicule</FormLabel>
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
                name="kmACharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Km à charge</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          className="pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? null : parseFloat(v));
                          }}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                          km
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Péages + notes */}
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="peages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Péages</FormLabel>
                    <div className="flex h-9 items-center gap-2">
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
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
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
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

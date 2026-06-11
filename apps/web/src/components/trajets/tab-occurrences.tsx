"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { Pencil, XCircle } from "lucide-react";
import { CalendarDateRangeIcon } from "@/components/ui/calendar-date-range-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { OccurrenceEditDialog } from "./occurrence-edit-dialog";
import type { OccurrenceOverrideFormValues } from "@/lib/validators/trajet";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  planifie: {
    label: "Planifié",
    variant: "outline",
  },
  en_cours: {
    label: "En cours",
    variant: "default",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  termine: {
    label: "Terminé",
    variant: "default",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  annule: {
    label: "Annulé",
    variant: "destructive",
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Décale une date ISO (yyyy-MM-dd) de `days` jours. */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

interface TabOccurrencesProps {
  trajetId: string;
  /** Fenêtre d'effectivité du trajet (repli : autour d'aujourd'hui). */
  windowStart?: string | null;
  windowEnd?: string | null;
}

export function TabOccurrences({
  trajetId,
  windowStart,
  windowEnd,
}: TabOccurrencesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Les occurrences sont dérivées de la récurrence du trajet : on liste la
  // fenêtre d'effectivité quand elle est connue, sinon une plage glissante.
  const today = new Date().toISOString().split("T")[0]!;
  const fromDate = windowStart ?? addDaysISO(today, -60);
  const rawToDate = windowEnd ?? addDaysISO(today, 300);
  // Garde serveur : 400 jours max.
  const maxToDate = addDaysISO(fromDate, 399);
  const toDate = rawToDate > maxToDate ? maxToDate : rawToDate;

  const [editingOccurrence, setEditingOccurrence] = useState<{
    date: string;
    chauffeurId: string | null;
    vehiculeId: string | null;
    departureTime: string | null;
    status: string;
    notes: string | null;
  } | null>(null);

  const { data: occurrences, isLoading } = useQuery(
    trpc.trajets.listOccurrences.queryOptions({
      trajetId,
      fromDate,
      toDate,
    }),
  );

  const updateMutation = useMutation(
    trpc.trajets.updateOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence modifiée");
        setEditingOccurrence(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const cancelMutation = useMutation(
    trpc.trajets.cancelOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence annulée");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'annulation");
      },
    }),
  );

  function handleEditSubmit(values: OccurrenceOverrideFormValues) {
    if (!editingOccurrence) return;
    updateMutation.mutate({
      trajetId,
      date: editingOccurrence.date,
      data: values,
    });
  }

  return (
    <div className="space-y-6">
      {/* Occurrences table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !occurrences || occurrences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-12">
          <CalendarDateRangeIcon size={40} className="text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune occurrence sur la période : vérifiez la récurrence et les
            dates du trajet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.3rem] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Statut
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Chauffeur
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Véhicule
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Horaire
                </TableHead>
                <TableHead className="h-10 w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {occurrences.map((occ) => {
                const statusConf = STATUS_CONFIG[occ.status] ?? STATUS_CONFIG.planifie!;
                return (
                  <TableRow key={occ.date} className="group">
                    <TableCell className="px-4 py-3">
                      <span className="font-medium">
                        {formatDate(occ.date)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant={statusConf.variant}
                        className={statusConf.className}
                      >
                        {statusConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={
                          occ.overrideChauffeurId
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {occ.chauffeurFirstName
                          ? `${occ.chauffeurFirstName} ${occ.chauffeurLastName}`
                          : "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={
                          occ.overrideVehiculeId
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {occ.vehiculeName ?? "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`font-mono text-sm ${
                          occ.overrideDepartureTime
                            ? "text-primary font-medium"
                            : ""
                        }`}
                      >
                        {occ.overrideDepartureTime ??
                          occ.trajetDepartureTime ??
                          "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                          onClick={() =>
                            setEditingOccurrence({
                              date: occ.date,
                              chauffeurId: occ.overrideChauffeurId,
                              vehiculeId: occ.overrideVehiculeId,
                              departureTime: occ.overrideDepartureTime,
                              status: occ.status,
                              notes: occ.overrideNotes,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {occ.status !== "annule" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                            onClick={() =>
                              cancelMutation.mutate({ trajetId, date: occ.date })
                            }
                            disabled={cancelMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <OccurrenceEditDialog
        open={!!editingOccurrence}
        onOpenChange={(open) => !open && setEditingOccurrence(null)}
        onSubmit={handleEditSubmit}
        defaultValues={
          editingOccurrence
            ? {
                chauffeurId: editingOccurrence.chauffeurId,
                vehiculeId: editingOccurrence.vehiculeId,
                departureTime: editingOccurrence.departureTime,
                status: editingOccurrence.status as "planifie" | "en_cours" | "termine" | "annule",
                notes: editingOccurrence.notes,
              }
            : undefined
        }
        isPending={updateMutation.isPending}
        occurrenceDate={
          editingOccurrence ? formatDate(editingOccurrence.date) : ""
        }
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { CalendarDays, Pencil, XCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    label: "Planifie",
    variant: "outline",
  },
  en_cours: {
    label: "En cours",
    variant: "default",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  termine: {
    label: "Termine",
    variant: "default",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  annule: {
    label: "Annule",
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

interface TabOccurrencesProps {
  trajetId: string;
}

export function TabOccurrences({ trajetId }: TabOccurrencesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Date range for generation
  const today = new Date().toISOString().split("T")[0]!;
  const threeMonths = new Date();
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  const defaultTo = threeMonths.toISOString().split("T")[0]!;

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(defaultTo);
  const [editingOccurrence, setEditingOccurrence] = useState<{
    id: string;
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
      fromDate: "2000-01-01",
      toDate: "2100-12-31",
    }),
  );

  const generateMutation = useMutation(
    trpc.trajets.generateOccurrences.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success(`${data.inserted} occurrence(s) generee(s)`);
      },
      onError: (err) => {
        toast.error(err.message || "Erreur lors de la generation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.trajets.updateOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence modifiee");
        setEditingOccurrence(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const cancelMutation = useMutation(
    trpc.trajets.cancelOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence annulee");
      },
      onError: () => {
        toast.error("Erreur lors de l'annulation");
      },
    }),
  );

  function handleEditSubmit(values: OccurrenceOverrideFormValues) {
    if (!editingOccurrence) return;
    updateMutation.mutate({ id: editingOccurrence.id, data: values });
  }

  return (
    <div className="space-y-6">
      {/* Generate occurrences */}
      <div className="rounded-[0.3rem] border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Generer des occurrences</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Du</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Au</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <Button
            onClick={() =>
              generateMutation.mutate({ trajetId, fromDate, toDate })
            }
            disabled={generateMutation.isPending}
            size="sm"
            className="cursor-pointer"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                generateMutation.isPending ? "animate-spin" : ""
              }`}
            />
            {generateMutation.isPending ? "Generation..." : "Generer"}
          </Button>
        </div>
      </div>

      {/* Occurrences table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !occurrences || occurrences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-12">
          <CalendarDays className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune occurrence. Generez des occurrences a partir de la recurrence.
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
                  Vehicule
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
                  <TableRow key={occ.id} className="group">
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
                              id: occ.id,
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
                              cancelMutation.mutate({ id: occ.id })
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

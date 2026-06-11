"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarDateRangeIcon } from "@/components/ui/calendar-date-range-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getWeekRange,
  getMonthCalendarDates,
  addWeeks,
  addMonths,
  formatDateISO,
  formatDateRange,
} from "@/lib/utils/date-helpers";
import { OccurrenceEditDialog } from "@/components/trajets/occurrence-edit-dialog";
import { CalendarGrid } from "./calendar-grid";
import { TimelineView } from "./timeline-view";
import { OccurrenceDetailSheet } from "./occurrence-detail-sheet";
import type { OccurrenceItem } from "./types";
import type { OccurrenceOverrideFormValues } from "@/lib/validators/trajet";

type PeriodMode = "week" | "month";
type DisplayMode = "calendar" | "timeline";

const DISPLAY_STORAGE_KEY = "planning:view";

// Délai avant d'ouvrir le sheet au simple clic : laisse au double-clic
// le temps d'annuler le clic simple (sinon le sheet flasherait).
const SINGLE_CLICK_DELAY_MS = 250;

function formatOccurrenceDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PlanningClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [period, setPeriod] = useState<PeriodMode>("week");
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<OccurrenceItem | null>(null);
  const [editingOccurrence, setEditingOccurrence] =
    useState<OccurrenceItem | null>(null);

  // Vue Calendrier/Timeline — SSR-safe : on rend « calendar » au premier
  // rendu, puis on applique post-mount le choix localStorage (prioritaire)
  // ou le défaut métier (transporteur → timeline).
  const [display, setDisplay] = useState<DisplayMode>("calendar");
  const hasStoredChoice = useRef(false);
  const { data: settings } = useQuery(trpc.tenantSettings.get.queryOptions());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_STORAGE_KEY);
      if (saved === "calendar" || saved === "timeline") {
        hasStoredChoice.current = true;
        setDisplay(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (hasStoredChoice.current) return;
    if (settings?.tenantType === "transporteur") setDisplay("timeline");
  }, [settings?.tenantType]);

  function chooseDisplay(mode: DisplayMode) {
    hasStoredChoice.current = true;
    setDisplay(mode);
    try {
      localStorage.setItem(DISPLAY_STORAGE_KEY, mode);
    } catch {}
  }

  // Compute date range based on period
  const { fromDate, toDate, rangeLabel } = useMemo(() => {
    if (period === "week") {
      const { start, end } = getWeekRange(currentDate);
      return {
        fromDate: formatDateISO(start),
        toDate: formatDateISO(end),
        rangeLabel: formatDateRange(start, end),
      };
    }
    // For month view, include overflow weeks
    const dates = getMonthCalendarDates(currentDate);
    const start = dates[0]!;
    const end = dates[dates.length - 1]!;
    return {
      fromDate: formatDateISO(start),
      toDate: formatDateISO(end),
      rangeLabel: currentDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [currentDate, period]);

  const { data: occurrences, isLoading, isError } = useQuery(
    trpc.trajets.listOccurrences.queryOptions({
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
        toast.success("Occurrence personnalisée");
        setEditingOccurrence(null);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la personnalisation");
      },
    }),
  );

  // Simple clic = sheet de détail (différé), double-clic = dialog de
  // personnalisation (annule le clic simple en attente).
  const clickTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  const handleOccurrenceClick = useCallback((occ: OccurrenceItem) => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      setSelectedOccurrence(occ);
    }, SINGLE_CLICK_DELAY_MS);
  }, []);

  const handleOccurrenceDoubleClick = useCallback((occ: OccurrenceItem) => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setSelectedOccurrence(null);
    setEditingOccurrence(occ);
  }, []);

  function handleEditSubmit(values: OccurrenceOverrideFormValues) {
    if (!editingOccurrence) return;
    updateMutation.mutate({
      trajetId: editingOccurrence.trajetId,
      date: editingOccurrence.date,
      data: values,
    });
  }

  function handleEditReset() {
    if (!editingOccurrence) return;
    updateMutation.mutate({
      trajetId: editingOccurrence.trajetId,
      date: editingOccurrence.date,
      data: {
        chauffeurId: null,
        vehiculeId: null,
        departureTime: null,
        notes: null,
      },
    });
  }

  function navigate(direction: -1 | 1) {
    if (period === "week") {
      setCurrentDate((d) => addWeeks(d, direction));
    } else {
      setCurrentDate((d) => addMonths(d, direction));
    }
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const isEmpty = !occurrences || occurrences.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Planning</h1>
          <p className="text-sm text-muted-foreground">
            {display === "calendar"
              ? "Vue calendrier des trajets"
              : "Vue timeline par ressource"}
          </p>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            className="cursor-pointer"
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(1)}
            className="cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">
            {rangeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch de vue Calendrier / Timeline */}
          <div className="flex items-center rounded-[0.3rem] border border-border">
            <Button
              variant={display === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => chooseDisplay("calendar")}
              className="cursor-pointer rounded-none rounded-l-[0.3rem]"
            >
              Calendrier
            </Button>
            <Button
              variant={display === "timeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => chooseDisplay("timeline")}
              className="cursor-pointer rounded-none rounded-r-[0.3rem]"
            >
              Timeline
            </Button>
          </div>

          {/* Période */}
          <div className="flex items-center rounded-[0.3rem] border border-border">
            <Button
              variant={period === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod("week")}
              className="cursor-pointer rounded-none rounded-l-[0.3rem]"
            >
              Semaine
            </Button>
            <Button
              variant={period === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod("month")}
              className="cursor-pointer rounded-none rounded-r-[0.3rem]"
            >
              Mois
            </Button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-destructive/40 py-12">
          <p className="text-sm text-destructive">
            Erreur lors du chargement des occurrences.
          </p>
        </div>
      ) : display === "timeline" ? (
        isEmpty ? (
          <EmptyState />
        ) : (
          <TimelineView
            currentDate={currentDate}
            period={period}
            occurrences={occurrences as OccurrenceItem[]}
            onOccurrenceClick={handleOccurrenceClick}
            onOccurrenceDoubleClick={handleOccurrenceDoubleClick}
          />
        )
      ) : isEmpty ? (
        <div>
          <CalendarGrid
            currentDate={currentDate}
            view={period}
            occurrences={[]}
            onOccurrenceClick={handleOccurrenceClick}
            onOccurrenceDoubleClick={handleOccurrenceDoubleClick}
          />
          <div className="mt-4">
            <EmptyState />
          </div>
        </div>
      ) : (
        <CalendarGrid
          currentDate={currentDate}
          view={period}
          occurrences={occurrences as OccurrenceItem[]}
          onOccurrenceClick={handleOccurrenceClick}
          onOccurrenceDoubleClick={handleOccurrenceDoubleClick}
        />
      )}

      {/* Detail sheet */}
      <OccurrenceDetailSheet
        occurrence={selectedOccurrence}
        onClose={() => setSelectedOccurrence(null)}
        onCustomize={() => {
          const occ = selectedOccurrence;
          setSelectedOccurrence(null);
          setEditingOccurrence(occ);
        }}
      />

      {/* Dialog de personnalisation ponctuelle */}
      <OccurrenceEditDialog
        open={!!editingOccurrence}
        onOpenChange={(open) => !open && setEditingOccurrence(null)}
        onSubmit={handleEditSubmit}
        onReset={handleEditReset}
        hideStatus
        defaultValues={
          editingOccurrence
            ? {
                chauffeurId: editingOccurrence.overrideChauffeurId,
                vehiculeId: editingOccurrence.overrideVehiculeId,
                departureTime: editingOccurrence.overrideDepartureTime,
                status: editingOccurrence.status as
                  | "planifie"
                  | "en_cours"
                  | "termine"
                  | "annule",
                notes: editingOccurrence.overrideNotes,
              }
            : undefined
        }
        isPending={updateMutation.isPending}
        occurrenceDate={
          editingOccurrence ? formatOccurrenceDate(editingOccurrence.date) : ""
        }
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-8">
      <CalendarDateRangeIcon size={40} className="text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        Aucun trajet ne circule sur cette période.
      </p>
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  getMonthRange,
  getMonthCalendarDates,
  addWeeks,
  addMonths,
  formatDateISO,
  formatDateRange,
} from "@/lib/utils/date-helpers";
import { CalendarGrid } from "./calendar-grid";
import { SchedulerView } from "./scheduler/scheduler-view";
import { OccurrenceFicheDialog } from "./occurrence-fiche-dialog";
import type { OccurrenceItem } from "./types";
import type {
  SchedulerViewMode,
  OccurrenceMoveData,
} from "./scheduler/types";

type PeriodMode = "week" | "month";
type DisplayMode = "planning" | "calendar";

// New key on purpose: the legacy "planning:view" values ("calendar"/"timeline")
// predate the Transcolaire-style scheduler and must not override its default.
const DISPLAY_STORAGE_KEY = "planning:display";

// Session-scoped navigation state (date + views): survives a page refresh,
// resets to "today" in a new tab/session.
const SESSION_STATE_KEY = "planning:session-state";

export function PlanningClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [period, setPeriod] = useState<PeriodMode>("week");
  // "jour" is the legacy Transcolaire default view.
  const [schedulerView, setSchedulerView] = useState<SchedulerViewMode>("jour");
  // "Fiche trajet du jour": opens on click, read mode first then
  // "Personnaliser" switches to edit (Transcolaire-style).
  const [ficheOccurrence, setFicheOccurrence] =
    useState<OccurrenceItem | null>(null);

  // Planning (resource scheduler) is the default view; the stored
  // choice is applied post-mount (SSR-safe). Legacy "timeline" values
  // map to the scheduler that replaced it.
  const [display, setDisplay] = useState<DisplayMode>("planning");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_STORAGE_KEY);
      if (saved === "calendar" || saved === "planning") setDisplay(saved);
    } catch {}
  }, []);

  // Restore the session navigation state (SSR-safe: applied post-mount).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        date?: string;
        view?: string;
        period?: string;
      };
      if (saved.date && /^\d{4}-\d{2}-\d{2}$/.test(saved.date)) {
        const d = new Date(saved.date + "T00:00:00");
        if (!Number.isNaN(d.getTime())) setCurrentDate(d);
      }
      if (
        saved.view === "jour" ||
        saved.view === "semaine" ||
        saved.view === "mois" ||
        saved.view === "trimestre"
      ) {
        setSchedulerView(saved.view);
      }
      if (saved.period === "week" || saved.period === "month") {
        setPeriod(saved.period);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_STATE_KEY,
        JSON.stringify({
          date: formatDateISO(currentDate),
          view: schedulerView,
          period,
        }),
      );
    } catch {}
  }, [currentDate, schedulerView, period]);

  function chooseDisplay(mode: DisplayMode) {
    setDisplay(mode);
    try {
      localStorage.setItem(DISPLAY_STORAGE_KEY, mode);
    } catch {}
  }

  // Date range to fetch + label, depending on the active view.
  const { fromDate, toDate, rangeLabel } = useMemo(() => {
    if (display === "planning") {
      switch (schedulerView) {
        case "jour": {
          const iso = formatDateISO(currentDate);
          return {
            fromDate: iso,
            toDate: iso,
            rangeLabel: currentDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          };
        }
        case "semaine": {
          const { start, end } = getWeekRange(currentDate);
          return {
            fromDate: formatDateISO(start),
            toDate: formatDateISO(end),
            rangeLabel: formatDateRange(start, end),
          };
        }
        case "mois": {
          const { start, end } = getMonthRange(currentDate);
          return {
            fromDate: formatDateISO(start),
            toDate: formatDateISO(end),
            rangeLabel: currentDate.toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            }),
          };
        }
        case "trimestre": {
          const start = getMonthRange(currentDate).start;
          const end = addMonths(start, 3);
          end.setDate(end.getDate() - 1);
          return {
            fromDate: formatDateISO(start),
            toDate: formatDateISO(end),
            rangeLabel: `${start.toLocaleDateString("fr-FR", {
              month: "long",
            })} – ${end.toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })}`,
          };
        }
      }
    }
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
  }, [display, schedulerView, currentDate, period]);

  const { data: occurrences, isLoading, isError, isFetching, refetch } =
    useQuery(
      trpc.trajets.listOccurrences.queryOptions({
        fromDate,
        toDate,
      }),
    );

  // Drag & drop in the scheduler (reassignment / time move).
  const moveMutation = useMutation(
    trpc.trajets.updateOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence déplacée");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors du déplacement");
      },
    }),
  );

  // Click (single or double) opens the fiche directly.
  const handleOccurrenceClick = useCallback((occ: OccurrenceItem) => {
    setFicheOccurrence(occ);
  }, []);

  const handleMoveOccurrence = useCallback(
    (occ: OccurrenceItem, data: OccurrenceMoveData) => {
      moveMutation.mutate({
        trajetId: occ.trajetId,
        date: occ.date,
        data,
      });
    },
    [moveMutation],
  );

  function navigate(direction: -1 | 1) {
    if (display === "planning") {
      if (schedulerView === "jour") {
        setCurrentDate((d) => {
          const next = new Date(d);
          next.setDate(next.getDate() + direction);
          return next;
        });
      } else if (schedulerView === "semaine") {
        setCurrentDate((d) => addWeeks(d, direction));
      } else {
        setCurrentDate((d) => addMonths(d, direction));
      }
      return;
    }
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Planning</h1>
          <p className="text-sm text-muted-foreground">
            {display === "planning"
              ? "Planning par ressource (chauffeurs / véhicules)"
              : "Vue calendrier des trajets"}
          </p>
        </div>

        {/* Planning / Calendar display switch */}
        <div className="flex items-center rounded-[0.3rem] border border-border">
          <Button
            variant={display === "planning" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => chooseDisplay("planning")}
            className="cursor-pointer rounded-none rounded-l-[0.3rem]"
          >
            Planning
          </Button>
          <Button
            variant={display === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => chooseDisplay("calendar")}
            className="cursor-pointer rounded-none rounded-r-[0.3rem]"
          >
            Calendrier
          </Button>
        </div>
      </div>

      {/* Calendar navigation bar (the scheduler has its own toolbar) */}
      {display === "calendar" && (
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

          {/* Period */}
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
      )}

      {/* Content */}
      {isError ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-destructive/40 py-12">
          <p className="text-sm text-destructive">
            Erreur lors du chargement des occurrences.
          </p>
        </div>
      ) : display === "planning" ? (
        <SchedulerView
          view={schedulerView}
          onViewChange={setSchedulerView}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onNavigate={navigate}
          onToday={goToday}
          rangeLabel={rangeLabel}
          occurrences={(occurrences ?? []) as OccurrenceItem[]}
          isFetching={isFetching}
          onRefresh={() => refetch()}
          onOccurrenceClick={handleOccurrenceClick}
          onOccurrenceDoubleClick={handleOccurrenceClick}
          onMoveOccurrence={handleMoveOccurrence}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isEmpty ? (
        <div>
          <CalendarGrid
            currentDate={currentDate}
            view={period}
            occurrences={[]}
            onOccurrenceClick={handleOccurrenceClick}
            onOccurrenceDoubleClick={handleOccurrenceClick}
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
          onOccurrenceDoubleClick={handleOccurrenceClick}
        />
      )}

      {/* Fiche trajet du jour (read first, then "Personnaliser") */}
      <OccurrenceFicheDialog
        occurrence={ficheOccurrence}
        onClose={() => setFicheOccurrence(null)}
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

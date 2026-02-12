"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
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
import { CalendarGrid } from "./calendar-grid";
import { OccurrenceDetailSheet } from "./occurrence-detail-sheet";

type ViewMode = "week" | "month";

interface OccurrenceItem {
  id: string;
  trajetId: string;
  date: string;
  status: string;
  trajetName: string;
  trajetDirection: string;
  trajetDepartureTime: string | null;
  overrideDepartureTime: string | null;
  circuitName: string | null;
  chauffeurFirstName: string | null;
  chauffeurLastName: string | null;
  vehiculeName: string | null;
  overrideNotes: string | null;
  overrideChauffeurId: string | null;
  overrideVehiculeId: string | null;
}

export function PlanningClient() {
  const trpc = useTRPC();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("week");
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<OccurrenceItem | null>(null);

  // Compute date range based on view
  const { fromDate, toDate, rangeLabel } = useMemo(() => {
    if (view === "week") {
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
  }, [currentDate, view]);

  const { data: occurrences, isLoading } = useQuery(
    trpc.trajets.listOccurrences.queryOptions({
      fromDate,
      toDate,
    }),
  );

  function navigate(direction: -1 | 1) {
    if (view === "week") {
      setCurrentDate((d) => addWeeks(d, direction));
    } else {
      setCurrentDate((d) => addMonths(d, direction));
    }
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Planning</h1>
          <p className="text-sm text-muted-foreground">
            Vue calendrier des trajets
          </p>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between">
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

        <div className="flex items-center rounded-[0.3rem] border border-border">
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("week")}
            className="cursor-pointer rounded-none rounded-l-[0.3rem]"
          >
            Semaine
          </Button>
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("month")}
            className="cursor-pointer rounded-none rounded-r-[0.3rem]"
          >
            Mois
          </Button>
        </div>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !occurrences || occurrences.length === 0 ? (
        <div>
          <CalendarGrid
            currentDate={currentDate}
            view={view}
            occurrences={[]}
            onOccurrenceClick={setSelectedOccurrence}
          />
          <div className="mt-4 flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-8">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune occurrence pour cette periode.
            </p>
          </div>
        </div>
      ) : (
        <CalendarGrid
          currentDate={currentDate}
          view={view}
          occurrences={occurrences as OccurrenceItem[]}
          onOccurrenceClick={setSelectedOccurrence}
        />
      )}

      {/* Detail sheet */}
      <OccurrenceDetailSheet
        occurrence={selectedOccurrence}
        onClose={() => setSelectedOccurrence(null)}
      />
    </div>
  );
}

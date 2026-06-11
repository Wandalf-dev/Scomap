"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isToday } from "@/lib/utils/date-helpers";
import { OccurrenceCard } from "./occurrence-card";
import { hasOverride, resolvedDepartureTime, type OccurrenceItem } from "./types";

// Limite d'occurrences visibles par cellule en vue mois (densité) ;
// en vue semaine tout est affiché.
const MONTH_VIEW_LIMIT = 3;

interface CalendarDayCellProps {
  date: Date;
  occurrences: OccurrenceItem[];
  isCurrentMonth: boolean;
  view: "week" | "month";
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
}

function renderCard(
  occ: OccurrenceItem,
  onOccurrenceClick: (occ: OccurrenceItem) => void,
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void,
) {
  return (
    <OccurrenceCard
      key={`${occ.trajetId}-${occ.date}`}
      trajetName={occ.trajetName}
      direction={occ.trajetDirection}
      departureTime={resolvedDepartureTime(occ)}
      status={occ.status}
      chauffeurName={
        occ.chauffeurFirstName
          ? `${occ.chauffeurFirstName} ${occ.chauffeurLastName}`
          : null
      }
      isCustomized={hasOverride(occ)}
      onClick={() => onOccurrenceClick(occ)}
      onDoubleClick={() => onOccurrenceDoubleClick(occ)}
    />
  );
}

export function CalendarDayCell({
  date,
  occurrences,
  isCurrentMonth,
  view,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
}: CalendarDayCellProps) {
  const today = isToday(date);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const isWeekView = view === "week";
  const visibleOccurrences = isWeekView
    ? occurrences
    : occurrences.slice(0, MONTH_VIEW_LIMIT);
  const hiddenCount = occurrences.length - visibleOccurrences.length;

  return (
    <div
      className={`min-h-[100px] border-b border-r border-border p-1 ${
        isCurrentMonth ? "" : "bg-muted/30"
      }`}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={`text-xs font-medium ${
            today
              ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              : isCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground/50"
          }`}
        >
          {date.getDate()}
        </span>
        {occurrences.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {occurrences.length}
          </span>
        )}
      </div>
      <div
        className={`space-y-1 ${
          isWeekView ? "max-h-[480px] overflow-y-auto" : ""
        }`}
      >
        {visibleOccurrences.map((occ) =>
          renderCard(occ, onOccurrenceClick, onOccurrenceDoubleClick),
        )}
        {hiddenCount > 0 && (
          <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded-[0.3rem] px-2 py-0.5 text-left text-xs text-muted-foreground transition-colors cursor-pointer hover:bg-accent/50 hover:text-foreground"
              >
                +{hiddenCount} autres
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {date.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                — {occurrences.length} occurrences
              </p>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {occurrences.map((occ) =>
                  renderCard(
                    occ,
                    (o) => {
                      // Ferme le popover avant d'ouvrir le sheet de détail
                      setOverflowOpen(false);
                      onOccurrenceClick(o);
                    },
                    (o) => {
                      setOverflowOpen(false);
                      onOccurrenceDoubleClick(o);
                    },
                  ),
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

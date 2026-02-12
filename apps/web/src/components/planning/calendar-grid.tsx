"use client";

import {
  getWeekRange,
  getMonthCalendarDates,
  getDatesInRange,
  formatDateISO,
} from "@/lib/utils/date-helpers";
import { CalendarDayCell } from "./calendar-day-cell";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

interface CalendarGridProps {
  currentDate: Date;
  view: "week" | "month";
  occurrences: OccurrenceItem[];
  onOccurrenceClick: (occ: OccurrenceItem) => void;
}

export function CalendarGrid({
  currentDate,
  view,
  occurrences,
  onOccurrenceClick,
}: CalendarGridProps) {
  // Group occurrences by date
  const occByDate = new Map<string, OccurrenceItem[]>();
  for (const occ of occurrences) {
    const key = occ.date;
    if (!occByDate.has(key)) occByDate.set(key, []);
    occByDate.get(key)!.push(occ);
  }

  // Sort each day's occurrences by departure time
  for (const [, dayOccs] of occByDate) {
    dayOccs.sort((a, b) => {
      const timeA = a.overrideDepartureTime ?? a.trajetDepartureTime ?? "";
      const timeB = b.overrideDepartureTime ?? b.trajetDepartureTime ?? "";
      return timeA.localeCompare(timeB);
    });
  }

  let dates: Date[];
  if (view === "week") {
    const { start, end } = getWeekRange(currentDate);
    dates = getDatesInRange(start, end);
  } else {
    dates = getMonthCalendarDates(currentDate);
  }

  const currentMonth = currentDate.getMonth();

  return (
    <div className="overflow-hidden rounded-[0.3rem] border-l border-t border-border bg-card">
      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-r border-border bg-muted/60 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const key = formatDateISO(date);
          return (
            <CalendarDayCell
              key={key}
              date={date}
              occurrences={occByDate.get(key) ?? []}
              isCurrentMonth={date.getMonth() === currentMonth}
              onOccurrenceClick={onOccurrenceClick}
            />
          );
        })}
      </div>
    </div>
  );
}

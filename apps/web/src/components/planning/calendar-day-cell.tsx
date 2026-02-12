"use client";

import { isToday } from "@/lib/utils/date-helpers";
import { OccurrenceCard } from "./occurrence-card";

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

interface CalendarDayCellProps {
  date: Date;
  occurrences: OccurrenceItem[];
  isCurrentMonth: boolean;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
}

export function CalendarDayCell({
  date,
  occurrences,
  isCurrentMonth,
  onOccurrenceClick,
}: CalendarDayCellProps) {
  const today = isToday(date);

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
      <div className="space-y-1">
        {occurrences.slice(0, 3).map((occ) => (
          <OccurrenceCard
            key={occ.id}
            trajetName={occ.trajetName}
            direction={occ.trajetDirection}
            departureTime={occ.overrideDepartureTime ?? occ.trajetDepartureTime}
            status={occ.status}
            chauffeurName={
              occ.chauffeurFirstName
                ? `${occ.chauffeurFirstName} ${occ.chauffeurLastName}`
                : null
            }
            onClick={() => onOccurrenceClick(occ)}
          />
        ))}
        {occurrences.length > 3 && (
          <div className="px-2 text-xs text-muted-foreground">
            +{occurrences.length - 3} autres
          </div>
        )}
      </div>
    </div>
  );
}

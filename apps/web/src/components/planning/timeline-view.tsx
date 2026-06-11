"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getWeekRange,
  getMonthRange,
  getDatesInRange,
  formatDateISO,
  isToday,
} from "@/lib/utils/date-helpers";
import { CustomizedIndicator } from "./occurrence-card";
import {
  hasOverride,
  resolvedDepartureTime,
  STATUS_DOTS,
  type OccurrenceItem,
} from "./types";

type ResourceMode = "chauffeurs" | "vehicules";

const UNASSIGNED_KEY = "__unassigned__";

interface TimelineViewProps {
  currentDate: Date;
  period: "week" | "month";
  occurrences: OccurrenceItem[];
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
}

interface TimelineRow {
  key: string;
  name: string;
  unassigned: boolean;
  occByDate: Map<string, OccurrenceItem[]>;
}

function resolveResource(
  occ: OccurrenceItem,
  mode: ResourceMode,
): { key: string; name: string; unassigned: boolean } {
  const id =
    mode === "chauffeurs"
      ? occ.overrideChauffeurId ?? occ.trajetChauffeurId
      : occ.overrideVehiculeId ?? occ.trajetVehiculeId;
  if (!id) {
    return { key: UNASSIGNED_KEY, name: "Non assigné", unassigned: true };
  }
  const name =
    mode === "chauffeurs"
      ? occ.chauffeurFirstName
        ? `${occ.chauffeurFirstName} ${occ.chauffeurLastName ?? ""}`.trim()
        : "Chauffeur inconnu"
      : occ.vehiculeName ?? "Véhicule inconnu";
  return { key: id, name, unassigned: false };
}

export function TimelineView({
  currentDate,
  period,
  occurrences,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
}: TimelineViewProps) {
  const [resourceMode, setResourceMode] = useState<ResourceMode>("chauffeurs");

  const dates = useMemo(() => {
    const range =
      period === "week" ? getWeekRange(currentDate) : getMonthRange(currentDate);
    return getDatesInRange(range.start, range.end);
  }, [currentDate, period]);

  // Lignes = ressources ayant au moins une occurrence sur la période,
  // « Non assigné » en tête, puis tri alphabétique.
  const rows = useMemo<TimelineRow[]>(() => {
    const map = new Map<string, TimelineRow>();
    for (const occ of occurrences) {
      const res = resolveResource(occ, resourceMode);
      let row = map.get(res.key);
      if (!row) {
        row = {
          key: res.key,
          name: res.name,
          unassigned: res.unassigned,
          occByDate: new Map(),
        };
        map.set(res.key, row);
      }
      const dayOccs = row.occByDate.get(occ.date) ?? [];
      dayOccs.push(occ);
      row.occByDate.set(occ.date, dayOccs);
    }
    for (const row of map.values()) {
      for (const dayOccs of row.occByDate.values()) {
        dayOccs.sort((a, b) =>
          (resolvedDepartureTime(a) ?? "").localeCompare(
            resolvedDepartureTime(b) ?? "",
          ),
        );
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [occurrences, resourceMode]);

  const isMonth = period === "month";
  const gridTemplateColumns = `160px repeat(${dates.length}, ${
    isMonth ? "minmax(96px, 1fr)" : "minmax(140px, 1fr)"
  })`;

  function dayCellTint(date: Date): string {
    if (isToday(date)) return "bg-primary/5";
    const day = date.getDay();
    if (day === 0 || day === 6) return "bg-muted/30";
    return "";
  }

  return (
    <div className="space-y-3">
      {/* Sous-switch ressource */}
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-[0.3rem] border border-border">
          <Button
            variant={resourceMode === "chauffeurs" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setResourceMode("chauffeurs")}
            className="cursor-pointer rounded-none rounded-l-[0.3rem]"
          >
            Chauffeurs
          </Button>
          <Button
            variant={resourceMode === "vehicules" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setResourceMode("vehicules")}
            className="cursor-pointer rounded-none rounded-r-[0.3rem]"
          >
            Véhicules
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[0.3rem] border border-border bg-card">
        <div className="grid" style={{ gridTemplateColumns }}>
          {/* En-tête : coin sticky + jours */}
          <div className="sticky left-0 z-20 border-b border-r border-border bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
            {resourceMode === "chauffeurs" ? "Chauffeur" : "Véhicule"}
          </div>
          {dates.map((date) => (
            <div
              key={formatDateISO(date)}
              className={`border-b border-r border-border bg-muted/60 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                isToday(date) ? "text-primary" : ""
              }`}
            >
              {date.toLocaleDateString("fr-FR", {
                weekday: isMonth ? "narrow" : "short",
                day: "numeric",
              })}
            </div>
          ))}

          {/* Lignes ressource */}
          {rows.map((row) => (
            <TimelineResourceRow
              key={row.key}
              row={row}
              dates={dates}
              dayCellTint={dayCellTint}
              onOccurrenceClick={onOccurrenceClick}
              onOccurrenceDoubleClick={onOccurrenceDoubleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TimelineResourceRowProps {
  row: TimelineRow;
  dates: Date[];
  dayCellTint: (date: Date) => string;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
}

function TimelineResourceRow({
  row,
  dates,
  dayCellTint,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
}: TimelineResourceRowProps) {
  const total = [...row.occByDate.values()].reduce(
    (sum, occs) => sum + occs.length,
    0,
  );

  return (
    <>
      <div className="sticky left-0 z-10 flex min-h-[52px] flex-col justify-center border-b border-r border-border bg-card px-3 py-2">
        <span
          className={`truncate text-sm font-medium ${
            row.unassigned ? "italic text-muted-foreground" : "text-foreground"
          }`}
        >
          {row.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {total} occurrence{total > 1 ? "s" : ""}
        </span>
      </div>
      {dates.map((date) => {
        const key = formatDateISO(date);
        const dayOccs = row.occByDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={`space-y-1 border-b border-r border-border p-1 ${dayCellTint(
              date,
            )}`}
          >
            {dayOccs.map((occ) => (
              <TimelineBlock
                key={`${occ.trajetId}-${occ.date}`}
                occurrence={occ}
                onClick={() => onOccurrenceClick(occ)}
                onDoubleClick={() => onOccurrenceDoubleClick(occ)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

interface TimelineBlockProps {
  occurrence: OccurrenceItem;
  onClick: () => void;
  onDoubleClick: () => void;
}

function TimelineBlock({
  occurrence,
  onClick,
  onDoubleClick,
}: TimelineBlockProps) {
  const isAller = occurrence.trajetDirection === "aller";
  const time = resolvedDepartureTime(occurrence);

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={occurrence.trajetName}
      className={`flex w-full items-center gap-1.5 rounded-[0.3rem] border px-1.5 py-1 text-left text-xs transition-colors cursor-pointer hover:bg-accent/50 ${
        isAller
          ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30"
      }`}
    >
      {/* Pastille direction : bleu aller / violet retour */}
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isAller
            ? "bg-blue-500 dark:bg-blue-400"
            : "bg-purple-500 dark:bg-purple-400"
        }`}
      />
      {time && (
        <span className="shrink-0 font-mono font-medium">{time}</span>
      )}
      <span className="truncate font-medium">{occurrence.trajetName}</span>
      {hasOverride(occurrence) && <CustomizedIndicator />}
      {/* Point de statut (mêmes conventions que les cartes calendrier) */}
      <span
        className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${
          STATUS_DOTS[occurrence.status] ?? STATUS_DOTS.planifie
        }`}
      />
    </button>
  );
}

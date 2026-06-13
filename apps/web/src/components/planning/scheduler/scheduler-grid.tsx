"use client";

import { useMemo, useRef } from "react";
import { formatDateISO, isToday } from "@/lib/utils/date-helpers";
import {
  hasOverride,
  resolvedDepartureTime,
  type OccurrenceItem,
} from "../types";
import {
  eventColor,
  occurrenceTooltip,
  chauffeurFullName,
  resolveResourceId,
  timeToMinutes,
  minutesToTime,
  CUSTOMIZED_BAND_COLOR,
  type SchedulerRow,
  type SchedulerViewMode,
  type ResourceMode,
  type EventDensity,
  type OccurrenceMoveData,
} from "./types";

// Default visible day window for the "jour" (time-scale) view — the actual
// window is a tenant setting (Paramètres > Planning), like the legacy
// HEUREDEBJOURNEE / HEUREFINJOURNEE parameters.
export const DEFAULT_DAY_WINDOW = { start: 5, end: 21 };

export interface DayWindow {
  start: number;
  end: number;
}

// Legacy scheduler_8 theme: dark grey header band with white text.
const HEADER_CELL =
  "bg-neutral-600 text-white dark:bg-neutral-700 border-white/15";

interface DragPayload {
  occ: OccurrenceItem;
  grabOffsetX: number;
}

interface SchedulerGridProps {
  view: SchedulerViewMode;
  dates: Date[];
  rows: SchedulerRow[];
  occurrences: OccurrenceItem[];
  resourceMode: ResourceMode;
  density: EventDensity;
  rowHeaderWide: boolean;
  cellWidth: number;
  dayWindow: DayWindow;
  isFetching: boolean;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
  onMoveOccurrence: (occ: OccurrenceItem, data: OccurrenceMoveData) => void;
}

export function SchedulerGrid({
  view,
  dates,
  rows,
  occurrences,
  resourceMode,
  density,
  rowHeaderWide,
  cellWidth,
  dayWindow,
  isFetching,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
  onMoveOccurrence,
}: SchedulerGridProps) {
  const rowHeaderWidth = rowHeaderWide ? 220 : 120;
  const dragRef = useRef<DragPayload | null>(null);

  // occurrences indexed by (resource row, date)
  const occByRow = useMemo(() => {
    const map = new Map<string, Map<string, OccurrenceItem[]>>();
    for (const occ of occurrences) {
      const rowKey = resolveResourceId(occ, resourceMode);
      let byDate = map.get(rowKey);
      if (!byDate) {
        byDate = new Map();
        map.set(rowKey, byDate);
      }
      const list = byDate.get(occ.date) ?? [];
      list.push(occ);
      byDate.set(occ.date, list);
    }
    for (const byDate of map.values()) {
      for (const list of byDate.values()) {
        list.sort((a, b) =>
          (resolvedDepartureTime(a) ?? "99:99").localeCompare(
            resolvedDepartureTime(b) ?? "99:99",
          ),
        );
      }
    }
    return map;
  }, [occurrences, resourceMode]);

  function moveToResource(occ: OccurrenceItem, row: SchedulerRow) {
    if (
      !window.confirm(
        `Confirmez-vous le déplacement ?\n${occ.trajetName} → ${row.name}`,
      )
    )
      return;
    onMoveOccurrence(
      occ,
      resourceMode === "chauffeurs"
        ? { chauffeurId: row.key }
        : { vehiculeId: row.key },
    );
  }

  const resourceLabel = resourceMode === "chauffeurs" ? "Chauffeur" : "Véhicule";

  const sharedProps = {
    rows,
    occByRow,
    rowHeaderWidth,
    density,
    rowHeaderWide,
    resourceLabel,
    isFetching,
    dragRef,
    resourceMode,
    onOccurrenceClick,
    onOccurrenceDoubleClick,
    onMoveOccurrence,
    moveToResource,
  };

  return (
    <div className="relative max-h-[calc(100vh-260px)] overflow-auto rounded-[0.3rem] border border-border bg-card print:max-h-none print:overflow-visible">
      {view === "jour" ? (
        <TimeScaleGrid
          {...sharedProps}
          date={dates[0]!}
          cellWidth={cellWidth}
          dayWindow={dayWindow}
        />
      ) : (
        <DayScaleGrid
          {...sharedProps}
          view={view}
          dates={dates}
          cellWidth={cellWidth}
        />
      )}
    </div>
  );
}

interface SharedGridProps {
  rows: SchedulerRow[];
  occByRow: Map<string, Map<string, OccurrenceItem[]>>;
  rowHeaderWidth: number;
  density: EventDensity;
  rowHeaderWide: boolean;
  resourceLabel: string;
  isFetching: boolean;
  dragRef: React.MutableRefObject<DragPayload | null>;
  resourceMode: ResourceMode;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
  onMoveOccurrence: (occ: OccurrenceItem, data: OccurrenceMoveData) => void;
  moveToResource: (occ: OccurrenceItem, row: SchedulerRow) => void;
}

function CornerCells({
  rowHeaderWidth,
  resourceLabel,
  isFetching,
}: {
  rowHeaderWidth: number;
  resourceLabel: string;
  isFetching: boolean;
}) {
  return (
    <div
      className={`sticky left-0 top-7 z-30 flex h-7 items-center border-b border-r px-2 text-xs font-semibold uppercase tracking-wider ${HEADER_CELL}`}
      style={{ width: rowHeaderWidth }}
    >
      {isFetching ? (
        <span className="animate-pulse normal-case tracking-normal">
          Chargement…
        </span>
      ) : (
        resourceLabel
      )}
    </div>
  );
}

function RowHeaderCell({
  row,
  rowHeaderWide,
  minHeight,
}: {
  row: SchedulerRow;
  rowHeaderWide: boolean;
  minHeight: number;
}) {
  return (
    <div
      className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-border bg-card px-2 py-1"
      style={{ minHeight }}
      title={row.tooltip ?? undefined}
    >
      <span
        className={`truncate text-xs font-semibold ${
          row.unassigned ? "italic text-muted-foreground" : "text-foreground"
        }`}
      >
        {row.name}
      </span>
      {rowHeaderWide && row.detail && (
        <span className="truncate text-[10px] text-muted-foreground">
          {row.detail}
        </span>
      )}
    </div>
  );
}

/** Second line of an event block (chauffeur, fallback circuit). */
function eventSubtitle(occ: OccurrenceItem): string | null {
  return chauffeurFullName(occ) ?? occ.circuitName;
}

/* ------------------------------------------------------------------ */
/* Day-scale grid: semaine / mois / 3 mois (one column per day)        */
/*                                                                     */
/* Each view renders events at the density its column width allows:    */
/* semaine = detailed blocks, mois = one-line blocks, 3 mois = bars.   */
/* ------------------------------------------------------------------ */

type DayEventVariant = "detailed" | "compact" | "bar" | "thin";

const DAY_VIEW_CONFIG: Record<
  string,
  {
    base: number;
    variant: Record<EventDensity, DayEventVariant>;
    minCellHeight: Record<EventDensity, number>;
  }
> = {
  semaine: {
    base: 130,
    variant: { expanded: "detailed", condensed: "compact" },
    minCellHeight: { expanded: 64, condensed: 32 },
  },
  mois: {
    base: 42,
    variant: { expanded: "compact", condensed: "bar" },
    minCellHeight: { expanded: 34, condensed: 22 },
  },
  // 3 mois: columns are too narrow for any text — pure color bars, the
  // tooltip carries the details (legacy behavior at small cell widths).
  trimestre: {
    base: 26,
    variant: { expanded: "thin", condensed: "thin" },
    minCellHeight: { expanded: 20, condensed: 14 },
  },
};

function DayScaleGrid({
  view,
  dates,
  cellWidth,
  rows,
  occByRow,
  rowHeaderWidth,
  density,
  rowHeaderWide,
  resourceLabel,
  isFetching,
  dragRef,
  resourceMode,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
  moveToResource,
}: SharedGridProps & {
  view: SchedulerViewMode;
  dates: Date[];
  cellWidth: number;
}) {
  const config = DAY_VIEW_CONFIG[view] ?? DAY_VIEW_CONFIG.mois!;
  const colWidth = Math.max(16, Math.round(config.base * (cellWidth / 20)));
  const variant = config.variant[density];
  const minCellHeight = config.minCellHeight[density];

  // Month band above the day columns (legacy time header group).
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    for (const date of dates) {
      const label = date.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.span += 1;
      else groups.push({ label, span: 1 });
    }
    return groups;
  }, [dates]);

  function dayHeaderLabel(date: Date): string {
    if (view === "semaine") {
      return date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
    }
    if (view === "mois") {
      return date.toLocaleDateString("fr-FR", {
        weekday: "narrow",
        day: "numeric",
      });
    }
    return String(date.getDate());
  }

  function bodyCellTint(date: Date): string {
    if (isToday(date)) return "bg-primary/5";
    const day = date.getDay();
    // Legacy: Saturday/Sunday cells greyed (#ddd)
    if (day === 0 || day === 6) return "bg-neutral-200/60 dark:bg-neutral-800/60";
    return "";
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `${rowHeaderWidth}px repeat(${dates.length}, minmax(${colWidth}px, 1fr))`,
      }}
    >
      {/* Header row 1: corner + month bands */}
      <div
        className={`sticky left-0 top-0 z-30 h-7 border-b border-r ${HEADER_CELL}`}
      />
      {monthGroups.map((group, i) => (
        <div
          key={`${group.label}-${i}`}
          className={`sticky top-0 z-20 flex h-7 items-center justify-center overflow-hidden border-b border-r px-2 text-xs font-medium capitalize ${HEADER_CELL}`}
          style={{ gridColumn: `span ${group.span}` }}
        >
          <span className="truncate">{group.label}</span>
        </div>
      ))}

      {/* Header row 2: corner + day columns */}
      <CornerCells
        rowHeaderWidth={rowHeaderWidth}
        resourceLabel={resourceLabel}
        isFetching={isFetching}
      />
      {dates.map((date) => (
        <div
          key={formatDateISO(date)}
          className={`sticky top-7 z-20 flex h-7 items-center justify-center overflow-hidden border-b border-r capitalize ${HEADER_CELL} ${
            view === "semaine" ? "text-[11px]" : "text-[10px]"
          } ${isToday(date) ? "font-bold underline underline-offset-2" : ""}`}
        >
          <span className="truncate px-0.5">{dayHeaderLabel(date)}</span>
        </div>
      ))}

      {/* Body */}
      {rows.map((row) => {
        const byDate = occByRow.get(row.key);
        return (
          <DayScaleRow
            key={row.key}
            row={row}
            dates={dates}
            byDate={byDate}
            variant={variant}
            rowHeaderWide={rowHeaderWide}
            minCellHeight={minCellHeight}
            bodyCellTint={bodyCellTint}
            dragRef={dragRef}
            resourceMode={resourceMode}
            onOccurrenceClick={onOccurrenceClick}
            onOccurrenceDoubleClick={onOccurrenceDoubleClick}
            moveToResource={moveToResource}
          />
        );
      })}
    </div>
  );
}

function DayScaleRow({
  row,
  dates,
  byDate,
  variant,
  rowHeaderWide,
  minCellHeight,
  bodyCellTint,
  dragRef,
  resourceMode,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
  moveToResource,
}: {
  row: SchedulerRow;
  dates: Date[];
  byDate: Map<string, OccurrenceItem[]> | undefined;
  variant: DayEventVariant;
  rowHeaderWide: boolean;
  minCellHeight: number;
  bodyCellTint: (date: Date) => string;
  dragRef: React.MutableRefObject<DragPayload | null>;
  resourceMode: ResourceMode;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
  moveToResource: (occ: OccurrenceItem, row: SchedulerRow) => void;
}) {
  return (
    <>
      <RowHeaderCell
        row={row}
        rowHeaderWide={rowHeaderWide}
        minHeight={minCellHeight}
      />
      {dates.map((date) => {
        const dateKey = formatDateISO(date);
        const dayOccs = byDate?.get(dateKey) ?? [];
        return (
          <div
            key={dateKey}
            className={`space-y-0.5 border-b border-r border-border p-0.5 ${bodyCellTint(date)}`}
            style={{ minHeight: minCellHeight }}
            onDragOver={(e) => {
              const drag = dragRef.current;
              if (!drag || row.unassigned) return;
              // Occurrences are derived per (trajet, date): the day cannot
              // change by drag, only the assigned resource can.
              if (drag.occ.date !== dateKey) return;
              if (resolveResourceId(drag.occ, resourceMode) === row.key) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const drag = dragRef.current;
              dragRef.current = null;
              if (!drag) return;
              moveToResource(drag.occ, row);
            }}
          >
            {dayOccs.map((occ) => (
              <DayScaleEvent
                key={`${occ.trajetId}-${occ.date}`}
                occ={occ}
                variant={variant}
                dragRef={dragRef}
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

function DayScaleEvent({
  occ,
  variant,
  dragRef,
  onClick,
  onDoubleClick,
}: {
  occ: OccurrenceItem;
  variant: DayEventVariant;
  dragRef: React.MutableRefObject<DragPayload | null>;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const colors = eventColor(occ);
  const customized = hasOverride(occ);
  const cancelled = occ.status === "annule";
  const time = resolvedDepartureTime(occ);
  const subtitle = eventSubtitle(occ);

  let content: React.ReactNode;
  if (variant === "detailed") {
    content = (
      <div
        className={`px-1.5 py-1 text-[11px] leading-tight ${
          cancelled ? "line-through opacity-90" : ""
        }`}
      >
        <div className="flex items-center gap-1">
          {time && (
            <span className="shrink-0 font-semibold tabular-nums">{time}</span>
          )}
          <span className="truncate font-medium">{occ.trajetName}</span>
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[10px] opacity-85">
            {subtitle}
          </div>
        )}
      </div>
    );
  } else if (variant === "compact") {
    content = (
      <div
        className={`flex items-center gap-1 px-1 text-[10px] leading-[18px] ${
          cancelled ? "line-through opacity-90" : ""
        }`}
      >
        {time && <span className="shrink-0 tabular-nums">{time}</span>}
        <span className="truncate">{occ.trajetName}</span>
      </div>
    );
  } else if (variant === "bar") {
    content = (
      <div
        className={`px-0.5 text-center text-[9px] leading-[13px] tabular-nums ${
          cancelled ? "line-through opacity-90" : ""
        }`}
      >
        {time ?? ""}
      </div>
    );
  } else {
    // thin: pure color bar, details on hover
    content = <div className="h-[7px]" />;
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        dragRef.current = {
          occ,
          grabOffsetX:
            e.clientX - e.currentTarget.getBoundingClientRect().left,
        };
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        dragRef.current = null;
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={occurrenceTooltip(occ)}
      className="block w-full cursor-pointer overflow-hidden rounded-[2px] border text-left text-white transition-[filter] hover:brightness-90"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderTopWidth: customized ? 3 : 1,
        borderTopColor: customized ? CUSTOMIZED_BAND_COLOR : colors.border,
      }}
    >
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Time-scale grid: "jour" view — the legacy default. One column per   */
/* hour stretching to the full width; events are positioned in % of    */
/* the day window with overlap lanes, so layout stays correct at any   */
/* container width.                                                    */
/* ------------------------------------------------------------------ */

function TimeScaleGrid({
  date,
  cellWidth,
  dayWindow,
  rows,
  occByRow,
  rowHeaderWidth,
  density,
  rowHeaderWide,
  resourceLabel,
  isFetching,
  dragRef,
  resourceMode,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
  onMoveOccurrence,
}: SharedGridProps & { date: Date; cellWidth: number; dayWindow: DayWindow }) {
  const hourStart = dayWindow.start;
  const hourEnd = dayWindow.end;
  const nHours = hourEnd - hourStart;
  const dayMinutes = nHours * 60;

  // Minimum width per hour column (the slider zooms); columns stretch (1fr)
  // to fill the available width beyond that.
  const hourMinWidth = Math.max(40, Math.round(72 * (cellWidth / 20)));
  const dateKey = formatDateISO(date);
  const blockHeight = density === "expanded" ? 40 : 20;

  const dayLabel = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Vertical grid lines in % so they match the stretched columns:
  // faint line every quarter hour, stronger line every hour.
  const lineBackground = {
    backgroundImage: `repeating-linear-gradient(to right, color-mix(in oklab, var(--border) 40%, transparent) 0 1px, transparent 1px calc(100% / ${nHours * 4})), repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px calc(100% / ${nHours}))`,
  };

  function handleDrop(e: React.DragEvent<HTMLDivElement>, row: SchedulerRow) {
    e.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - drag.grabOffsetX;
    const rawMinutes = hourStart * 60 + (x / rect.width) * dayMinutes;
    const snapped = Math.round(rawMinutes / 15) * 15;
    const clamped = Math.min(
      Math.max(snapped, hourStart * 60),
      hourEnd * 60 - 15,
    );
    const newTime = minutesToTime(clamped);

    const currentRowKey = resolveResourceId(drag.occ, resourceMode);
    const resourceChanged = currentRowKey !== row.key;
    const timeChanged = newTime !== resolvedDepartureTime(drag.occ);
    if (!resourceChanged && !timeChanged) return;

    if (
      !window.confirm(
        `Confirmez-vous le déplacement ?\n${drag.occ.trajetName} → ${row.name} à ${newTime}`,
      )
    )
      return;

    const data: OccurrenceMoveData = { departureTime: newTime };
    if (resourceChanged) {
      if (resourceMode === "chauffeurs") data.chauffeurId = row.key;
      else data.vehiculeId = row.key;
    }
    onMoveOccurrence(drag.occ, data);
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `${rowHeaderWidth}px repeat(${nHours}, minmax(${hourMinWidth}px, 1fr))`,
      }}
    >
      {/* Header row 1: corner + full date (centered) */}
      <div
        className={`sticky left-0 top-0 z-30 h-7 border-b border-r ${HEADER_CELL}`}
      />
      <div
        className={`sticky top-0 z-20 flex h-7 items-center justify-center border-b border-r px-2 text-xs font-medium capitalize ${HEADER_CELL}`}
        style={{ gridColumn: `span ${nHours}` }}
      >
        {dayLabel}
      </div>

      {/* Header row 2: corner + hours */}
      <CornerCells
        rowHeaderWidth={rowHeaderWidth}
        resourceLabel={resourceLabel}
        isFetching={isFetching}
      />
      {Array.from({ length: nHours }, (_, i) => (
        <div
          key={i}
          className={`sticky top-7 z-20 flex h-7 items-center border-b border-r px-1.5 text-[11px] tabular-nums ${HEADER_CELL}`}
        >
          {String(hourStart + i).padStart(2, "0")}:00
        </div>
      ))}

      {/* Body rows */}
      {rows.map((row) => {
        const dayOccs = occByRow.get(row.key)?.get(dateKey) ?? [];
        const positioned = layoutLanes(dayOccs, hourStart, hourEnd);
        const rowHeight = Math.max(
          blockHeight + 16,
          positioned.laneCount * (blockHeight + 4) + 12,
        );

        return (
          <div key={row.key} className="contents">
            <RowHeaderCell
              row={row}
              rowHeaderWide={rowHeaderWide}
              minHeight={rowHeight}
            />
            <div
              className="relative border-b border-border"
              style={{
                gridColumn: "2 / -1",
                minHeight: rowHeight,
                ...lineBackground,
              }}
              onDragOver={(e) => {
                if (!dragRef.current || row.unassigned) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => handleDrop(e, row)}
            >
              {positioned.events.map(
                ({ occ, lane, startMin, durationMin, noTime }) => (
                  <TimeScaleEvent
                    key={`${occ.trajetId}-${occ.date}`}
                    occ={occ}
                    noTime={noTime}
                    density={density}
                    dragRef={dragRef}
                    style={{
                      left: `${((startMin - hourStart * 60) / dayMinutes) * 100}%`,
                      width: `max(${(durationMin / dayMinutes) * 100}%, 110px)`,
                      top: 6 + lane * (blockHeight + 4),
                      height: blockHeight,
                    }}
                    onClick={() => onOccurrenceClick(occ)}
                    onDoubleClick={() => onOccurrenceDoubleClick(occ)}
                  />
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PositionedEvent {
  occ: OccurrenceItem;
  lane: number;
  startMin: number;
  durationMin: number;
  noTime: boolean;
}

// Greedy lane assignment so overlapping events stack vertically
// (DayPilot-like behavior). Lanes use a minimum VISUAL duration so that
// short trips whose rendered blocks overlap (min block width) still get
// separate lanes.
const MIN_VISUAL_MINUTES = 75;

function layoutLanes(
  occs: OccurrenceItem[],
  hourStart: number,
  hourEnd: number,
): {
  events: PositionedEvent[];
  laneCount: number;
} {
  const prepared = occs
    .map((occ) => {
      const raw = timeToMinutes(resolvedDepartureTime(occ));
      const noTime = raw === null;
      const startMin = Math.min(
        Math.max(raw ?? hourStart * 60, hourStart * 60),
        hourEnd * 60 - 15,
      );
      const durationMin = Math.max(
        15,
        Math.round((occ.trajetDurationSeconds ?? 1800) / 60),
      );
      return { occ, startMin, durationMin, noTime };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const laneEnds: number[] = [];
  const events: PositionedEvent[] = [];
  for (const ev of prepared) {
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] =
      ev.startMin + Math.max(ev.durationMin, MIN_VISUAL_MINUTES);
    events.push({ ...ev, lane });
  }
  return { events, laneCount: Math.max(1, laneEnds.length) };
}

function TimeScaleEvent({
  occ,
  noTime,
  density,
  dragRef,
  style,
  onClick,
  onDoubleClick,
}: {
  occ: OccurrenceItem;
  noTime: boolean;
  density: EventDensity;
  dragRef: React.MutableRefObject<DragPayload | null>;
  style: React.CSSProperties;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const colors = eventColor(occ);
  const customized = hasOverride(occ);
  const cancelled = occ.status === "annule";
  const time = resolvedDepartureTime(occ);
  const subtitle = eventSubtitle(occ);

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        dragRef.current = {
          occ,
          grabOffsetX:
            e.clientX - e.currentTarget.getBoundingClientRect().left,
        };
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        dragRef.current = null;
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={
        noTime
          ? `${occurrenceTooltip(occ)}\n(horaire non défini)`
          : occurrenceTooltip(occ)
      }
      className={`absolute cursor-pointer overflow-hidden rounded-[2px] border text-left text-white shadow-sm transition-[filter] hover:brightness-90 ${
        noTime ? "border-dashed opacity-80" : ""
      }`}
      style={{
        ...style,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderTopWidth: customized ? 3 : 1,
        borderTopColor: customized ? CUSTOMIZED_BAND_COLOR : colors.border,
      }}
    >
      {density === "expanded" ? (
        <div
          className={`px-1.5 py-0.5 text-[11px] leading-tight ${
            cancelled ? "line-through opacity-90" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            {time && (
              <span className="shrink-0 font-semibold tabular-nums">
                {time}
              </span>
            )}
            <span className="truncate font-medium">{occ.trajetName}</span>
          </div>
          {subtitle && (
            <div className="truncate text-[10px] opacity-85">{subtitle}</div>
          )}
        </div>
      ) : (
        <div
          className={`flex items-center gap-1 px-1 text-[10px] leading-[18px] ${
            cancelled ? "line-through opacity-90" : ""
          }`}
        >
          {time && <span className="shrink-0 tabular-nums">{time}</span>}
          <span className="truncate">{occ.trajetName}</span>
        </div>
      )}
    </button>
  );
}

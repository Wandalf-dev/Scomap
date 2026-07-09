"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  getWeekRange,
  getMonthRange,
  getDatesInRange,
  addMonths,
} from "@/lib/utils/date-helpers";
import type { OccurrenceItem } from "../types";
import { SchedulerToolbar } from "./scheduler-toolbar";
import { SchedulerGrid, DEFAULT_DAY_WINDOW } from "./scheduler-grid";
import {
  EMPTY_FILTERS,
  UNASSIGNED_ROW_KEY,
  occurrenceMatchesText,
  resolveResourceId,
  type SchedulerViewMode,
  type ResourceMode,
  type EventDensity,
  type SchedulerFilters,
  type SchedulerRow,
  type OccurrenceMoveData,
} from "./types";

interface SchedulerViewProps {
  view: SchedulerViewMode;
  onViewChange: (view: SchedulerViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  rangeLabel: string;
  occurrences: OccurrenceItem[];
  isFetching: boolean;
  onRefresh: () => void;
  onOccurrenceClick: (occ: OccurrenceItem) => void;
  onOccurrenceDoubleClick: (occ: OccurrenceItem) => void;
  onMoveOccurrence: (occ: OccurrenceItem, data: OccurrenceMoveData) => void;
}

export function SchedulerView({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onNavigate,
  onToday,
  rangeLabel,
  occurrences,
  isFetching,
  onRefresh,
  onOccurrenceClick,
  onOccurrenceDoubleClick,
  onMoveOccurrence,
}: SchedulerViewProps) {
  const trpc = useTRPC();

  const [resourceMode, setResourceMode] = useState<ResourceMode>("chauffeurs");
  const [rowFilter, setRowFilter] = useState("");
  const [contentFilter, setContentFilter] = useState("");
  const [filters, setFilters] = useState<SchedulerFilters>(EMPTY_FILTERS);
  const [density, setDensity] = useState<EventDensity>("expanded");
  const [rowHeaderWide, setRowHeaderWide] = useState(false);
  const [cellWidth, setCellWidth] = useState(20);

  const { data: chauffeurList } = useQuery(trpc.chauffeurs.list.queryOptions());
  const { data: vehiculeList } = useQuery(trpc.vehicules.list.queryOptions());
  const { data: circuitList } = useQuery(trpc.circuits.list.queryOptions({}));
  const { data: etablissementList } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );
  const { data: tenantSettings } = useQuery(
    trpc.tenantSettings.get.queryOptions(),
  );

  // Day window of the "jour" view (tenant setting, Paramètres > Planning);
  // guard against inconsistent values.
  const dayWindow = useMemo(() => {
    const start = tenantSettings?.planningDayStart ?? DEFAULT_DAY_WINDOW.start;
    const end = tenantSettings?.planningDayEnd ?? DEFAULT_DAY_WINDOW.end;
    return end > start ? { start, end } : { ...DEFAULT_DAY_WINDOW };
  }, [tenantSettings?.planningDayStart, tenantSettings?.planningDayEnd]);

  const dates = useMemo(() => {
    if (view === "jour") return [new Date(currentDate)];
    if (view === "semaine") {
      const { start, end } = getWeekRange(currentDate);
      return getDatesInRange(start, end);
    }
    if (view === "mois") {
      const { start, end } = getMonthRange(currentDate);
      return getDatesInRange(start, end);
    }
    // 3 mois: from the start of the current month
    const start = getMonthRange(currentDate).start;
    const end = new Date(addMonths(start, 3));
    end.setDate(end.getDate() - 1);
    return getDatesInRange(start, end);
  }, [view, currentDate]);

  // Applied filters + "Filtre contenu" → visible events.
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      if (filters.circuitId && occ.circuitId !== filters.circuitId) return false;
      if (
        filters.etablissementId &&
        occ.etablissementId !== filters.etablissementId
      )
        return false;
      if (
        filters.chauffeurId &&
        (occ.overrideChauffeurId ?? occ.trajetChauffeurId) !==
          filters.chauffeurId
      )
        return false;
      if (
        filters.vehiculeId &&
        (occ.overrideVehiculeId ?? occ.trajetVehiculeId) !== filters.vehiculeId
      )
        return false;
      if (filters.direction && occ.trajetDirection !== filters.direction)
        return false;
      if (filters.statut && occ.status !== filters.statut) return false;
      return occurrenceMatchesText(occ, contentFilter);
    });
  }, [occurrences, filters, contentFilter]);

  // Resource rows: every active resource is listed (like the legacy planning),
  // inactive ones only if an occurrence still references them.
  const rows = useMemo<SchedulerRow[]>(() => {
    const referenced = new Set(
      filteredOccurrences.map((occ) => resolveResourceId(occ, resourceMode)),
    );

    let resourceRows: SchedulerRow[];
    if (resourceMode === "chauffeurs") {
      resourceRows = (chauffeurList ?? [])
        .filter((c) => c.isActive || referenced.has(c.id))
        .map((c) => ({
          key: c.id,
          name: `${c.lastName.toUpperCase()} ${c.firstName}`,
          detail: c.phone ?? null,
          tooltip:
            [
              `${c.firstName} ${c.lastName}`,
              c.phone ? `Tél : ${c.phone}` : null,
              c.email ? `Email : ${c.email}` : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
          unassigned: false,
        }));
    } else {
      resourceRows = (vehiculeList ?? [])
        .filter((v) => v.isActive || referenced.has(v.id))
        .map((v) => ({
          key: v.id,
          name: v.name,
          detail:
            [v.licensePlate, [v.brand, v.model].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ") || null,
          tooltip:
            [
              v.name,
              v.licensePlate ? `Immat. : ${v.licensePlate}` : null,
              v.brand || v.model
                ? `${[v.brand, v.model].filter(Boolean).join(" ")}`
                : null,
              v.capacity ? `Capacité : ${v.capacity} places` : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
          unassigned: false,
        }));
    }

    resourceRows.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    // Resource picked in the filter form → keep only that row.
    const selectedResource =
      resourceMode === "chauffeurs" ? filters.chauffeurId : filters.vehiculeId;
    if (selectedResource) {
      resourceRows = resourceRows.filter((r) => r.key === selectedResource);
    }

    // Live row filter (legacy "Filtre chauffeur"); the unassigned row
    // stays always visible, like the legacy "-1" row.
    const needle = rowFilter.trim().toUpperCase();
    if (needle) {
      resourceRows = resourceRows.filter((r) =>
        r.name.toUpperCase().includes(needle),
      );
    }

    return [
      {
        key: UNASSIGNED_ROW_KEY,
        name: "Non affecté",
        detail: null,
        tooltip:
          resourceMode === "chauffeurs"
            ? "Trajets sans chauffeur assigné"
            : "Trajets sans véhicule assigné",
        unassigned: true,
      },
      ...resourceRows,
    ];
  }, [
    resourceMode,
    chauffeurList,
    vehiculeList,
    filteredOccurrences,
    filters.chauffeurId,
    filters.vehiculeId,
    rowFilter,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SchedulerToolbar
        view={view}
        onViewChange={onViewChange}
        currentDate={currentDate}
        onDateChange={onDateChange}
        onNavigate={onNavigate}
        onToday={onToday}
        rangeLabel={rangeLabel}
        resourceMode={resourceMode}
        onResourceModeChange={setResourceMode}
        rowFilter={rowFilter}
        onRowFilterChange={setRowFilter}
        contentFilter={contentFilter}
        onContentFilterChange={setContentFilter}
        filters={filters}
        onApplyFilters={setFilters}
        circuitOptions={(circuitList ?? []).map((c) => ({
          id: c.id,
          label: c.code ? `${c.code} — ${c.name}` : c.name,
        }))}
        etablissementOptions={(etablissementList ?? []).map((e) => ({
          id: e.id,
          label: e.name,
        }))}
        chauffeurOptions={(chauffeurList ?? []).map((c) => ({
          id: c.id,
          label: `${c.lastName.toUpperCase()} ${c.firstName}`,
        }))}
        vehiculeOptions={(vehiculeList ?? []).map((v) => ({
          id: v.id,
          label: v.name,
        }))}
        density={density}
        onDensityChange={setDensity}
        rowHeaderWide={rowHeaderWide}
        onRowHeaderWideChange={setRowHeaderWide}
        cellWidth={cellWidth}
        onCellWidthChange={setCellWidth}
        onPrint={() => window.print()}
        onRefresh={onRefresh}
        isFetching={isFetching}
      />

      <SchedulerGrid
        view={view}
        dates={dates}
        rows={rows}
        occurrences={filteredOccurrences}
        resourceMode={resourceMode}
        density={density}
        rowHeaderWide={rowHeaderWide}
        cellWidth={cellWidth}
        dayWindow={dayWindow}
        isFetching={isFetching}
        onOccurrenceClick={onOccurrenceClick}
        onOccurrenceDoubleClick={onOccurrenceDoubleClick}
        onMoveOccurrence={onMoveOccurrence}
      />
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColumnPicker } from "./column-picker";

import type { DragEndEvent } from "@dnd-kit/core";

interface DataListToolbarProps {
  storageKey?: string;
  totalColumnCount: number;
  visibleColumnCount: number;
  orderedColumns: Array<{ key: string; header: string }>;
  columnOrder: string[];
  hiddenColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  onColumnDragEnd: (event: DragEndEvent) => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  /** Dataset/scope tabs — first in the left cluster. */
  tabsSlot?: React.ReactNode;
  /** Page navigation (prev/numbers/next) — left cluster, after the column picker. */
  pagination?: React.ReactNode;
  /** Record range + page-size selector — far right of the toolbar. */
  paginationMeta?: React.ReactNode;
}

function Divider() {
  // Matches the app's header-divider convention (entity-detail-layout, etc.).
  return <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />;
}

/**
 * Single controls band above the table. LEFT cluster = dataset tabs + column
 * picker + page navigation. RIGHT cluster = active-filter summary + the record
 * range and page-size selector. Subtle dividers separate the groups.
 */
export function DataListToolbar({
  storageKey,
  totalColumnCount,
  visibleColumnCount,
  orderedColumns,
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onResetColumns,
  onColumnDragEnd,
  hasActiveFilters,
  filteredCount,
  totalCount,
  onClearFilters,
  tabsSlot,
  pagination,
  paginationMeta,
}: DataListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* Left cluster — dataset tabs, column picker, page navigation */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tabsSlot}
        {tabsSlot && (storageKey || pagination) && <Divider />}
        {storageKey && (
          <ColumnPicker
            storageKey={storageKey}
            totalColumnCount={totalColumnCount}
            visibleColumnCount={visibleColumnCount}
            orderedColumns={orderedColumns}
            columnOrder={columnOrder}
            hiddenColumns={hiddenColumns}
            onToggleColumn={onToggleColumn}
            onReset={onResetColumns}
            onDragEnd={onColumnDragEnd}
          />
        )}
        {storageKey && pagination && <Divider />}
        {pagination}
      </div>

      {/* Right cluster — active-filter summary + record range / page size */}
      {(hasActiveFilters || paginationMeta) && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {hasActiveFilters && (
            <>
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                <b className="font-semibold tabular-nums text-foreground">
                  {filteredCount}
                </b>{" "}
                sur {totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Tout effacer
              </Button>
            </>
          )}
          {hasActiveFilters && paginationMeta && <Divider />}
          {paginationMeta}
        </div>
      )}
    </div>
  );
}

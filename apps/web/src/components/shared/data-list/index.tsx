"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "nextjs-toploader/app";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { DataListTable } from "./data-list-table";
import { DataListToolbar } from "./data-list-toolbar";
import { exportDataListToXlsx } from "./export-xlsx";
import { useColumnResize } from "./use-column-resize";
import { useDataListState } from "./use-data-list-state";

import type { DataListProps, FilterConfig } from "./types";

export type { ColumnConfig, FilterConfig, RowAction, BulkAction } from "./types";

export function DataList<TRow, TFilters extends Record<string, string>>({
  data,
  isLoading,
  error,
  title,
  description,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  addButtonLabel,
  addHref,
  columns,
  getRowId,
  onRowClick,
  filters: filterConfigs,
  emptyFilters,
  filterFn,
  actions,
  sortColumn,
  sortDirection,
  onSort,
  sortFn,
  onBulkDelete,
  isBulkDeleting,
  bulkActions,
  children,
  rowAccent,
  storageKey,
  defaultVisibleColumns,
}: DataListProps<TRow, TFilters>) {
  const router = useRouter();

  const {
    filterValues,
    updateFilter,
    clearFilters,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    colsHydrated,
    hiddenColumns,
    columnOrder,
    toggleColumn,
    resetColumns,
    handleColumnDragEnd,
    visibleColumns,
    orderedColumns,
  } = useDataListState<TRow, TFilters>({
    columns,
    emptyFilters,
    storageKey,
    defaultVisibleColumns,
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filterValues).some(([key, val]) => {
      const config = filterConfigs.find((f) => f.key === key);
      if (config?.type === "select") return val !== "all";
      return val !== "";
    });
  }, [filterValues, filterConfigs]);


  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.filter((row) => filterFn(row, filterValues));
    if (sortColumn && sortDirection && sortFn) {
      result = [...result].sort((a, b) => sortFn(a, b, sortColumn, sortDirection));
    }
    return result;
  }, [data, filterValues, filterFn, sortColumn, sortDirection, sortFn]);

  // Selection purge: without this, rows that were checked then hidden by a
  // filter (or by switching the Courants/Archivés tab) stayed bulk-deletable
  // even though they were no longer visible.
  const filteredIds = useMemo(
    () => new Set(filtered.map(getRowId)),
    [filtered, getRowId],
  );
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (filteredIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [filteredIds]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedRows = useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Selection helpers
  const pageRowIds = useMemo(() => paginatedRows.map(getRowId), [paginatedRows, getRowId]);
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageRowIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRowIds.forEach((id) => next.delete(id));
      } else {
        pageRowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const {
    tableRef,
    columnWidths,
    hasFixedWidths,
    totalWidth,
    actionsColWidth,
    checkboxColWidth,
    handleResizeStart,
  } = useColumnResize(columns);

  const filterConfigByKey = useMemo(() => {
    const map = new Map<string, FilterConfig>();
    filterConfigs.forEach((fc) => map.set(fc.key, fc));
    return map;
  }, [filterConfigs]);

  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Erreur lors du chargement.
        </p>
      </div>
    );
  }

  const selectionCount = selectedIds.size;

  async function handleExport(scope: "page" | "all") {
    const rowsToExport =
      scope === "all"
        ? filtered
        : selectionCount > 0
          ? filtered.filter((row) => selectedIds.has(getRowId(row)))
          : paginatedRows;

    await exportDataListToXlsx({
      title,
      columns: visibleColumns,
      rows: rowsToExport,
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {addHref && (
          <Button
            onClick={() => router.push(addHref)}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Toolbar — rendered only after mount so SSR and the first client render
          are identical (a Radix-free skeleton). The toolbar + table hold every
          useId-bearing component (Popover, per-row DropdownMenu, pagination
          Select); their tree-id positions depend on persisted column prefs and
          locale sort order, which only resolve client-side. Deferring them
          removes the entire useId hydration-mismatch class. */}
      {colsHydrated && data && data.length > 0 && (
        <DataListToolbar
          storageKey={storageKey}
          totalColumnCount={columns.length}
          visibleColumnCount={visibleColumns.length}
          orderedColumns={orderedColumns}
          columnOrder={columnOrder}
          hiddenColumns={hiddenColumns}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
          onColumnDragEnd={handleColumnDragEnd}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filtered.length}
          totalCount={data.length}
          onClearFilters={clearFilters}
          selectionCount={selectionCount}
          selectedIds={selectedIds}
          onClearSelection={clearSelection}
          onExport={handleExport}
          totalPages={totalPages}
          safePage={safePage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          bulkActions={bulkActions}
          hasBulkDelete={!!onBulkDelete}
          onBulkDeleteOpen={() => setBulkDeleteOpen(true)}
        />
      )}


      {/* Table or Loading or Empty */}
      {!colsHydrated || isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-16">
          <EmptyIcon size={48} className="text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {emptyTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
          {addHref && addButtonLabel && (
            <Button
              onClick={() => router.push(addHref)}
              variant="outline"
              className="mt-4 cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              {addButtonLabel}
            </Button>
          )}
        </div>
      ) : (
        <DataListTable
          tableRef={tableRef}
          hasFixedWidths={hasFixedWidths}
          totalWidth={totalWidth}
          columnWidths={columnWidths}
          checkboxColWidth={checkboxColWidth}
          actionsColWidth={actionsColWidth}
          onResizeStart={handleResizeStart}
          visibleColumns={visibleColumns}
          filterConfigByKey={filterConfigByKey}
          filterValues={filterValues}
          onFilterChange={updateFilter}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          rows={paginatedRows}
          getRowId={getRowId}
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          somePageSelected={somePageSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={onRowClick}
          rowAccent={rowAccent}
          actions={actions}
          emptyIcon={EmptyIcon}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectionCount={selectionCount}
        isBulkDeleting={isBulkDeleting}
        onConfirm={() => {
          onBulkDelete?.(Array.from(selectedIds));
          setBulkDeleteOpen(false);
          clearSelection();
        }}
      />

      {children}
    </div>
  );
}

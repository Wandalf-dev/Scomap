"use client";

import {
  MoreHorizontal,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineColumnFilter } from "./inline-column-filter";

import type { ColumnConfig, FilterConfig, RowAction } from "./types";

interface SortIconProps {
  column: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}

function SortIcon({ column, sortColumn, sortDirection }: SortIconProps) {
  if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />;
  return sortDirection === "asc"
    ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
    : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
}

interface DataListTableProps<TRow> {
  tableRef: React.RefObject<HTMLTableElement | null>;
  hasFixedWidths: boolean;
  totalWidth: number;
  columnWidths: Record<string, number>;
  checkboxColWidth: number;
  actionsColWidth: number;
  onResizeStart: (key: string, e: React.MouseEvent | React.TouchEvent) => void;
  visibleColumns: ColumnConfig<TRow>[];
  filterConfigByKey: Map<string, FilterConfig>;
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  rows: TRow[];
  getRowId: (row: TRow) => string;
  selectedIds: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (row: TRow) => void;
  rowAccent?: (row: TRow) => string | null | undefined;
  actions: RowAction<TRow>[];
  emptyIcon: React.ElementType;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function DataListTable<TRow>({
  tableRef,
  hasFixedWidths,
  totalWidth,
  columnWidths,
  checkboxColWidth,
  actionsColWidth,
  onResizeStart,
  visibleColumns,
  filterConfigByKey,
  filterValues,
  onFilterChange,
  sortColumn,
  sortDirection,
  onSort,
  rows,
  getRowId,
  selectedIds,
  allPageSelected,
  somePageSelected,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  rowAccent,
  actions,
  emptyIcon: EmptyIcon,
  hasActiveFilters,
  onClearFilters,
}: DataListTableProps<TRow>) {
  const quickActions = actions.filter((a) => a.quick);
  return (
    <div className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-[0.3rem] border border-border bg-card">
      {/* THE single scroll region (both axes). The page itself doesn't scroll
          (app-shell layout), so this is the only scrollbar. The column+filter
          header sticks to the top of THIS box. NB: a raw <table> is used instead
          of the <Table> ui wrapper — that wrapper injects an `overflow-x-auto`
          div which would become the sticky header's scroll container and break
          the pinning. */}
      <div className="min-h-0 flex-1 overflow-auto">
      <table
        ref={tableRef}
        className="w-full caption-bottom text-sm"
        style={
          hasFixedWidths
            ? { tableLayout: "fixed" as const, width: totalWidth, minWidth: "100%" }
            : undefined
        }
      >
        <TableHeader>
          <TableRow className="bg-accent hover:bg-accent">
            {/* With table-layout:auto, the cell `width` is ignored (the column
                shrinks to its content). The checkbox column width therefore
                comes from the inner <div>'s `w-12`, not from `w-[48px]`. */}
            <TableHead
              className="sticky top-0 z-20 w-[48px] border-b border-border bg-accent px-0"
              style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
            >
              <div className="mx-auto flex w-12 items-center justify-center">
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={onToggleSelectAll}
                  className="cursor-pointer"
                  aria-label="Sélectionner toutes les lignes de la page"
                />
              </div>
            </TableHead>
            {visibleColumns.map((col) => {
              const fc = filterConfigByKey.get(col.key);
              return (
                <TableHead
                  key={col.key}
                  // `sticky` (not `relative`) — it both pins the header and acts
                  // as the containing block for the absolute resize handle.
                  className={`sticky top-0 z-20 border-b border-border bg-accent ${
                    col.sortable
                      ? "cursor-pointer select-none hover:text-foreground transition-colors"
                      : ""
                  } ${col.className ?? ""}`}
                  style={hasFixedWidths ? { width: columnWidths[col.key] } : undefined}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  aria-sort={
                    col.sortable
                      ? sortColumn === col.key
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  <div
                    className={`flex flex-col gap-1.5 pr-1.5 ${fc ? "min-w-[6.5rem] pt-1.5 pb-3" : "py-1"}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSort(col.key);
                        }}
                        className="flex shrink-0 cursor-pointer items-center gap-1 text-left font-medium"
                      >
                        {col.header}
                        <SortIcon
                          column={col.key}
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                        />
                      </button>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1">
                        {col.header}
                      </span>
                    )}
                    {fc && (
                      <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineColumnFilter
                          config={fc}
                          value={filterValues[fc.key] ?? ""}
                          onChange={(v) => onFilterChange(fc.key, v)}
                        />
                      </div>
                    )}
                  </div>
                  <div
                    onMouseDown={(e) => onResizeStart(col.key, e)}
                    onTouchStart={(e) => onResizeStart(col.key, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-0 right-0 w-px h-full cursor-col-resize bg-border/40 hover:bg-primary hover:w-[3px] transition-all"
                    style={{ userSelect: "none", touchAction: "none" }}
                  />
                </TableHead>
              );
            })}
            <TableHead
              className="sticky top-0 z-20 w-[50px] border-b border-border bg-accent"
              style={hasFixedWidths ? { width: actionsColWidth } : undefined}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + 2}
                className="h-32 text-center"
              >
                <div className="flex flex-col items-center gap-1">
                  <EmptyIcon size={32} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? "Aucun résultat pour ces filtres"
                      : "Aucun résultat"}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClearFilters}
                      className="mt-2 cursor-pointer"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Effacer les filtres
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds.has(rowId);
              const accent = rowAccent?.(row);
              return (
                <TableRow
                  key={rowId}
                  tabIndex={0}
                  className={`cursor-pointer group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${isSelected ? "bg-primary/5" : ""}`}
                  onClick={() => onRowClick(row)}
                  onKeyDown={(e) => {
                    // Only the row itself: don't steal Enter/Space from the
                    // inner controls (checkbox, actions menu)
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  <TableCell
                    className="relative w-[48px] px-0"
                    style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {accent && (
                      <span
                        className={`absolute inset-y-0 left-0 w-1 ${accent}`}
                        aria-hidden
                      />
                    )}
                    <div className="mx-auto flex w-12 items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(rowId)}
                        className="cursor-pointer"
                        aria-label="Sélectionner la ligne"
                      />
                    </div>
                  </TableCell>
                  {visibleColumns.map((col, colIdx) => (
                    <TableCell
                      key={col.key}
                      className={`${colIdx === 0 ? "font-medium" : ""} ${col.className ?? ""} ${hasFixedWidths ? "overflow-hidden text-ellipsis" : ""}`}
                      style={hasFixedWidths ? { width: columnWidths[col.key] } : undefined}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                  <TableCell
                    className="px-2 py-3"
                    style={hasFixedWidths ? { width: actionsColWidth } : undefined}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      {quickActions.length > 0 && (
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {quickActions.map((action) => (
                            <Button
                              key={action.label}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
                              title={action.label}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                            >
                              <action.icon className="h-4 w-4" />
                              <span className="sr-only">{action.label}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action) => (
                          <div key={action.label}>
                            {action.separator && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              className={`cursor-pointer ${
                                action.variant === "destructive"
                                  ? "text-destructive focus:text-destructive"
                                  : ""
                              }`}
                            >
                              <action.icon className="mr-2 h-4 w-4" />
                              {action.label}
                            </DropdownMenuItem>
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  X,
  ListFilter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { LucideIcon } from "lucide-react";

export interface ColumnConfig<TRow> {
  key: string;
  header: string;
  className?: string;
  sortable?: boolean;
  render: (row: TRow) => React.ReactNode;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  className?: string;
}

export interface RowAction<TRow> {
  label: string;
  icon: LucideIcon;
  onClick: (row: TRow) => void;
  variant?: "default" | "destructive";
  separator?: boolean;
}

interface DataListProps<TRow, TFilters extends Record<string, string>> {
  data: TRow[] | undefined;
  isLoading: boolean;
  error?: unknown;
  title: string;
  description: string;
  emptyIcon: React.ElementType;
  emptyTitle: string;
  emptyDescription: string;
  addButtonLabel: string;
  addHref: string;
  columns: ColumnConfig<TRow>[];
  getRowId: (row: TRow) => string;
  onRowClick: (row: TRow) => void;
  filters: FilterConfig[];
  emptyFilters: TFilters;
  filterFn: (row: TRow, filters: TFilters) => boolean;
  actions: RowAction<TRow>[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  sortFn?: (a: TRow, b: TRow, column: string, direction: "asc" | "desc") => number;
  onBulkDelete?: (ids: string[]) => void;
  isBulkDeleting?: boolean;
  children?: React.ReactNode;
}

const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000];

function SortIcon({ column, sortColumn, sortDirection }: {
  column: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}) {
  if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />;
  return sortDirection === "asc"
    ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
    : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
}

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
  children,
}: DataListProps<TRow, TFilters>) {
  const router = useRouter();
  const [filterValues, setFilterValues] = useState<TFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filterValues).some(([key, val]) => {
      const config = filterConfigs.find((f) => f.key === key);
      if (config?.type === "select") return val !== "all";
      return val !== "";
    });
  }, [filterValues, filterConfigs]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filterValues).filter(([key, val]) => {
      const config = filterConfigs.find((f) => f.key === key);
      if (config?.type === "select") return val !== "all";
      return val !== "";
    }).length;
  }, [filterValues, filterConfigs]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.filter((row) => filterFn(row, filterValues));
    if (sortColumn && sortDirection && sortFn) {
      result = [...result].sort((a, b) => sortFn(a, b, sortColumn, sortDirection));
    }
    return result;
  }, [data, filterValues, filterFn, sortColumn, sortDirection, sortFn]);

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

  // ── Column resize ──────────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const hasFixedWidths = Object.keys(columnWidths).length > 0;
  const actionsColWidth = 50;
  const checkboxColWidth = 44;
  const totalWidth = hasFixedWidths
    ? columns.reduce((sum, col) => sum + (columnWidths[col.key] ?? 0), 0) + actionsColWidth + checkboxColWidth
    : 0;

  const captureAllWidths = useCallback(() => {
    if (Object.keys(columnWidths).length > 0) return columnWidths;
    const table = tableRef.current;
    if (!table) return {};
    const headers = table.querySelectorAll<HTMLTableCellElement>("thead th");
    const widths: Record<string, number> = {};
    // Skip first header (checkbox col)
    columns.forEach((col, i) => {
      if (headers[i + 1]) widths[col.key] = headers[i + 1].getBoundingClientRect().width;
    });
    return widths;
  }, [columns, columnWidths]);

  const handleResizeStart = useCallback(
    (key: string, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentWidths = captureAllWidths();
      setColumnWidths(currentWidths);
      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth = currentWidths[key] ?? 150;

      const handleMove = (clientX: number) => {
        const newWidth = Math.max(60, startWidth + (clientX - startX));
        setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
      };
      const handleMouseMove = (ev: MouseEvent) => handleMove(ev.clientX);
      const handleTouchMove = (ev: TouchEvent) => handleMove(ev.touches[0].clientX);

      const handleEnd = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchend", handleEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      if ("touches" in e) {
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleEnd);
      } else {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleEnd);
      }
    },
    [captureAllWidths],
  );

  function updateFilter(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  }

  function clearFilters() {
    setFilterValues(emptyFilters);
    setCurrentPage(0);
  }

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={() => router.push(addHref)}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Toolbar */}
      {data && data.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            variant={showFilters || hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setShowFilters(!showFilters);
              if (showFilters && hasActiveFilters) clearFilters();
            }}
            className="cursor-pointer"
          >
            <ListFilter className="mr-2 h-4 w-4" />
            Filtres
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs font-medium bg-primary text-primary-foreground"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <>
              <span className="text-sm text-muted-foreground">
                {filtered.length} sur {data.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reinitialiser
              </Button>
            </>
          )}

          {/* Bulk actions */}
          {selectionCount > 0 && onBulkDelete && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-medium text-foreground">
                {selectionCount} selectionne{selectionCount > 1 ? "s" : ""}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="h-8 cursor-pointer px-2"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Deselectionner
              </Button>
            </>
          )}
        </div>
      )}

      {/* Filters bar */}
      {showFilters && data && data.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-[0.3rem] border border-border bg-card p-3">
          {filterConfigs.map((fc) => (
            <div key={fc.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                {fc.label}
              </label>
              {fc.type === "text" ? (
                <Input
                  placeholder={fc.placeholder ?? "Rechercher..."}
                  value={filterValues[fc.key] ?? ""}
                  onChange={(e) => updateFilter(fc.key, e.target.value)}
                  className={fc.className ?? "h-8 w-40 text-sm"}
                />
              ) : (
                <Select
                  value={filterValues[fc.key] ?? "all"}
                  onValueChange={(v) => updateFilter(fc.key, v)}
                >
                  <SelectTrigger className={fc.className ?? "h-8 w-36 cursor-pointer text-sm"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fc.options?.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="cursor-pointer"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table or Loading or Empty */}
      {isLoading ? (
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
          <Button
            onClick={() => router.push(addHref)}
            variant="outline"
            className="mt-4 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            {addButtonLabel}
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[0.3rem] border border-border bg-card">
            <Table
              ref={tableRef}
              style={
                hasFixedWidths
                  ? { tableLayout: "fixed" as const, width: totalWidth, minWidth: "100%" }
                  : undefined
              }
            >
              <TableHeader>
                <TableRow className="bg-accent hover:bg-accent">
                  <TableHead
                    className="w-[44px]"
                    style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
                  >
                    <Checkbox
                      checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`relative ${
                        col.sortable
                          ? "cursor-pointer select-none hover:text-foreground transition-colors"
                          : ""
                      } ${col.className ?? ""}`}
                      style={hasFixedWidths ? { width: columnWidths[col.key] } : undefined}
                      onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                    >
                      {col.sortable ? (
                        <span className="flex items-center">
                          {col.header}
                          <SortIcon
                            column={col.key}
                            sortColumn={sortColumn}
                            sortDirection={sortDirection}
                          />
                        </span>
                      ) : (
                        col.header
                      )}
                      <div
                        onMouseDown={(e) => handleResizeStart(col.key, e)}
                        onTouchStart={(e) => handleResizeStart(col.key, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-0 right-0 w-px h-full cursor-col-resize bg-border/40 hover:bg-primary hover:w-[3px] transition-all"
                        style={{ userSelect: "none", touchAction: "none" }}
                      />
                    </TableHead>
                  ))}
                  <TableHead
                    className="w-[50px]"
                    style={hasFixedWidths ? { width: actionsColWidth } : undefined}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columns.length + 2}
                      className="h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <EmptyIcon size={32} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Aucun resultat pour ces filtres
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => {
                    const rowId = getRowId(row);
                    const isSelected = selectedIds.has(rowId);
                    return (
                      <TableRow
                        key={rowId}
                        className={`cursor-pointer group transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => onRowClick(row)}
                      >
                        <TableCell
                          className="w-[44px]"
                          style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(rowId)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        {columns.map((col, colIdx) => (
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
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filtered.length} enregistrement{filtered.length > 1 ? "s" : ""}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>Par page :</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] cursor-pointer text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)} className="cursor-pointer">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  disabled={safePage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectionCount} element{selectionCount > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer{" "}
              <strong>{selectionCount} element{selectionCount > 1 ? "s" : ""}</strong> ?
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBulkDeleting}
              className="cursor-pointer"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkDelete?.(Array.from(selectedIds));
                setBulkDeleteOpen(false);
                clearSelection();
              }}
              disabled={isBulkDeleting}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {children}
    </div>
  );
}

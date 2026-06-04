"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "nextjs-toploader/app";
import {
  Plus,
  MoreHorizontal,
  X,
  Columns3,
  RotateCcw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  DownloadCloud,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { exportToXlsx } from "@/lib/utils/export-xlsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  /** Raw value used for xlsx export (defaults to row[key]) */
  exportValue?: (row: TRow) => string | number | Date | null | undefined;
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
  /** localStorage key for persisting column visibility/order. If omitted, picker is hidden. */
  storageKey?: string;
  /** Default visible column keys. If omitted, all are visible. */
  defaultVisibleColumns?: string[];
}

const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000];

/**
 * Returns a compact list of pages to display (0-indexed) with "..." for gaps.
 * Always includes first and last; centers a window around the current page.
 */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | "...")[] = [0];
  const windowStart = Math.max(1, current - 1);
  const windowEnd = Math.min(total - 2, current + 1);
  if (windowStart > 1) pages.push("...");
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
  if (windowEnd < total - 2) pages.push("...");
  pages.push(total - 1);
  return pages;
}

function InlineColumnFilter({
  config,
  value,
  onChange,
}: {
  config: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const active = config.type === "select" ? value !== "" && value !== "all" : !!value;

  if (config.type === "select") {
    return (
      <Select value={value || "all"} onValueChange={onChange}>
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          className={`h-7 w-full cursor-pointer text-xs font-normal ${
            active ? "border-primary/50 text-foreground" : "text-muted-foreground"
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {config.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Input
        placeholder={config.placeholder ?? "Filtrer…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className={`h-7 w-full text-xs font-normal ${active ? "border-primary/50 pr-6" : ""}`}
      />
      {active && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label={`Effacer le filtre ${config.label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SortableColumnRow({
  id,
  header,
  checked,
  onToggle,
}: {
  id: string;
  header: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        aria-label="Réorganiser"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="cursor-pointer"
        id={`col-${id}`}
      />
      <label
        htmlFor={`col-${id}`}
        className="flex-1 cursor-pointer text-sm select-none"
      >
        {header}
      </label>
    </div>
  );
}

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
  storageKey,
  defaultVisibleColumns,
}: DataListProps<TRow, TFilters>) {
  const router = useRouter();
  const [filterValues, setFilterValues] = useState<TFilters>(emptyFilters);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);

  // Column visibility + order (persisted)
  const allColumnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const visibilityStorageKey = storageKey ? `datalist:${storageKey}:visibility` : null;
  const orderStorageKey = storageKey ? `datalist:${storageKey}:order` : null;

  // SSR-safe defaults (no localStorage): server and first client render must
  // match, otherwise the column count differs and Radix useId order shifts,
  // producing a hydration mismatch on every Select/DropdownMenu in the table.
  const initialHiddenColumns = useMemo(() => {
    if (defaultVisibleColumns) {
      return new Set(allColumnKeys.filter((k) => !defaultVisibleColumns.includes(k)));
    }
    return new Set<string>();
  }, [allColumnKeys, defaultVisibleColumns]);

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(initialHiddenColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(allColumnKeys);
  const [colsHydrated, setColsHydrated] = useState(false);

  // Load persisted prefs only after mount (post-hydration).
  useEffect(() => {
    if (visibilityStorageKey) {
      try {
        const raw = localStorage.getItem(visibilityStorageKey);
        if (raw) setHiddenColumns(new Set(JSON.parse(raw) as string[]));
      } catch {}
    }
    if (orderStorageKey) {
      try {
        const raw = localStorage.getItem(orderStorageKey);
        if (raw) {
          const saved = JSON.parse(raw) as string[];
          // Merge: keep saved order for known keys, append any new keys at end
          const known = new Set(allColumnKeys);
          const ordered = saved.filter((k) => known.has(k));
          const missing = allColumnKeys.filter((k) => !ordered.includes(k));
          setColumnOrder([...ordered, ...missing]);
        }
      } catch {}
    }
    setColsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist (only after hydration, so defaults don't clobber saved prefs)
  useEffect(() => {
    if (!colsHydrated || !visibilityStorageKey) return;
    try {
      localStorage.setItem(visibilityStorageKey, JSON.stringify([...hiddenColumns]));
    } catch {}
  }, [hiddenColumns, visibilityStorageKey, colsHydrated]);

  useEffect(() => {
    if (!colsHydrated || !orderStorageKey) return;
    try {
      localStorage.setItem(orderStorageKey, JSON.stringify(columnOrder));
    } catch {}
  }, [columnOrder, orderStorageKey, colsHydrated]);

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const pickerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function resetColumns() {
    setHiddenColumns(
      defaultVisibleColumns
        ? new Set(allColumnKeys.filter((k) => !defaultVisibleColumns.includes(k)))
        : new Set(),
    );
    setColumnOrder(allColumnKeys);
  }

  // Derived: visible + ordered columns
  const visibleColumns = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return columnOrder
      .filter((k) => !hiddenColumns.has(k))
      .map((k) => byKey.get(k))
      .filter((c): c is ColumnConfig<TRow> => Boolean(c));
  }, [columns, columnOrder, hiddenColumns]);

  // All columns (ordered) for the picker
  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return columnOrder
      .map((k) => byKey.get(k))
      .filter((c): c is ColumnConfig<TRow> => Boolean(c));
  }, [columns, columnOrder]);

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

    const exportColumns = visibleColumns.map((col) => ({
      header: col.header,
      value: (row: TRow) => {
        if (col.exportValue) return col.exportValue(row);
        const raw = (row as unknown as Record<string, unknown>)[col.key];
        if (raw === null || raw === undefined) return null;
        if (typeof raw === "string" || typeof raw === "number") return raw;
        if (raw instanceof Date) return raw;
        return String(raw);
      },
    }));

    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const today = new Date().toISOString().split("T")[0];
    const filename = `${slug}-${today}.xlsx`;

    await exportToXlsx({
      filename,
      sheetName: title.slice(0, 31),
      columns: exportColumns,
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
          {storageKey && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Colonnes
                  {hiddenColumns.size > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs font-medium bg-primary text-primary-foreground"
                    >
                      {visibleColumns.length}/{columns.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm font-medium">Colonnes affichées</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                    onClick={resetColumns}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Réinitialiser
                  </Button>
                </div>
                <DndContext
                  id={`datalist-${storageKey}-columns-dnd`}
                  sensors={pickerSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
                >
                  <SortableContext
                    items={columnOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="max-h-80 overflow-y-auto py-1">
                      {orderedColumns.map((col) => (
                        <SortableColumnRow
                          key={col.key}
                          id={col.key}
                          header={col.header}
                          checked={!hiddenColumns.has(col.key)}
                          onToggle={() => toggleColumn(col.key)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </PopoverContent>
            </Popover>
          )}

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
                Tout effacer
              </Button>
            </>
          )}

          {/* Export buttons */}
          <div className="h-4 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => handleExport("page")}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectionCount > 0
                ? `Exporter la sélection (${selectionCount})`
                : "Exporter la page courante"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => handleExport("all")}
              >
                <DownloadCloud className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Exporter tout ({filtered.length})
            </TooltipContent>
          </Tooltip>

          {/* Pagination inline */}
          {totalPages > 1 && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={safePage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers(safePage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-1 text-sm text-muted-foreground select-none"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === safePage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 cursor-pointer tabular-nums"
                    onClick={() => setCurrentPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                  >
                    {p + 1}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
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
                    className="w-[44px] px-0"
                    style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </div>
                  </TableHead>
                  {visibleColumns.map((col) => {
                    const fc = filterConfigByKey.get(col.key);
                    return (
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
                        <div className="flex items-center gap-2 pr-1.5">
                          <span className="flex shrink-0 items-center gap-1">
                            {col.header}
                            {col.sortable && (
                              <SortIcon
                                column={col.key}
                                sortColumn={sortColumn}
                                sortDirection={sortDirection}
                              />
                            )}
                          </span>
                          {fc && (
                            <div className="ml-auto min-w-[5rem] flex-1">
                              <InlineColumnFilter
                                config={fc}
                                value={filterValues[fc.key] ?? ""}
                                onChange={(v) => updateFilter(fc.key, v)}
                              />
                            </div>
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => handleResizeStart(col.key, e)}
                          onTouchStart={(e) => handleResizeStart(col.key, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-0 right-0 w-px h-full cursor-col-resize bg-border/40 hover:bg-primary hover:w-[3px] transition-all"
                          style={{ userSelect: "none", touchAction: "none" }}
                        />
                      </TableHead>
                    );
                  })}
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
                      colSpan={visibleColumns.length + 2}
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
                          className="w-[44px] px-0"
                          style={hasFixedWidths ? { width: checkboxColWidth } : undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(rowId)}
                              className="cursor-pointer"
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
                        >
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer: total + page size */}
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

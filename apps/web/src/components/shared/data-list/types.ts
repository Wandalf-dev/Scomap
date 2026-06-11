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
  type: "text" | "select" | "date" | "daterange";
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

/** Bulk action on the selection (the "Actions" menu of the selection bar). */
export interface BulkAction {
  label: string;
  icon: LucideIcon;
  /** Receives the selected ids; the selection is cleared right after. */
  onClick: (ids: string[]) => void;
  variant?: "default" | "destructive";
  separator?: boolean;
}

export interface DataListProps<TRow, TFilters extends Record<string, string>> {
  data: TRow[] | undefined;
  isLoading: boolean;
  error?: unknown;
  title: string;
  description: string;
  emptyIcon: React.ElementType;
  emptyTitle: string;
  emptyDescription: string;
  /** Add button: hidden when addHref is absent (e.g. "Archivés" tab). */
  addButtonLabel?: string;
  addHref?: string;
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
  /** Bulk actions ("Actions" menu) shown when rows are checked. */
  bulkActions?: BulkAction[];
  children?: React.ReactNode;
  /** Optional left-edge accent bar per row. Return a Tailwind bg-* class (e.g. "bg-blue-500") or null. */
  rowAccent?: (row: TRow) => string | null | undefined;
  /** localStorage key for persisting column visibility/order. If omitted, picker is hidden. */
  storageKey?: string;
  /** Default visible column keys. If omitted, all are visible. */
  defaultVisibleColumns?: string[];
}

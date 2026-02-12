"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  X,
  ListFilter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  emptyIcon: LucideIcon;
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
  children?: React.ReactNode;
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
  children,
}: DataListProps<TRow, TFilters>) {
  const router = useRouter();
  const [filterValues, setFilterValues] = useState<TFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

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

  function updateFilter(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilterValues(emptyFilters);
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
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <EmptyIcon className="h-12 w-12 text-muted-foreground/50" />
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
        <div className="overflow-hidden rounded-[0.3rem] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                      col.sortable
                        ? "cursor-pointer select-none hover:text-foreground transition-colors"
                        : ""
                    } ${col.className ?? ""}`}
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
                  </TableHead>
                ))}
                <TableHead className="h-10 w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <EmptyIcon className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Aucun resultat pour ces filtres
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    className="cursor-pointer group transition-colors"
                    onClick={() => onRowClick(row)}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`px-4 py-3 ${col.className ?? ""}`}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                    <TableCell className="px-2 py-3">
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {children}
    </div>
  );
}

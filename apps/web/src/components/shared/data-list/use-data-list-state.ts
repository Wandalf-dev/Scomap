"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { arrayMove } from "@dnd-kit/sortable";
import { PAGE_SIZE_OPTIONS } from "./pagination";

import type { DragEndEvent } from "@dnd-kit/core";
import type { ColumnConfig } from "./types";

interface UseDataListStateOptions<TRow, TFilters extends Record<string, string>> {
  columns: ColumnConfig<TRow>[];
  emptyFilters: TFilters;
  storageKey?: string;
  defaultVisibleColumns?: string[];
}

export function useDataListState<TRow, TFilters extends Record<string, string>>({
  columns,
  emptyFilters,
  storageKey,
  defaultVisibleColumns,
}: UseDataListStateOptions<TRow, TFilters>) {
  const pathname = usePathname();
  const [filterValues, setFilterValues] = useState<TFilters>(emptyFilters);

  // Filters/page/page size persisted in sessionStorage: without this, opening a
  // detail page then coming back remounted the component and lost the whole
  // working state.
  const stateStorageKey = `datalist:${storageKey ?? pathname}:state`;

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
    try {
      const raw = sessionStorage.getItem(stateStorageKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          filters?: Record<string, string>;
          page?: number;
          pageSize?: number;
        };
        if (saved.filters) {
          const allowed = new Set(Object.keys(emptyFilters));
          const restored = Object.fromEntries(
            Object.entries(saved.filters).filter(([k]) => allowed.has(k)),
          );
          setFilterValues((prev) => ({ ...prev, ...restored }) as TFilters);
        }
        if (typeof saved.pageSize === "number" && PAGE_SIZE_OPTIONS.includes(saved.pageSize)) {
          setPageSize(saved.pageSize);
        }
        if (typeof saved.page === "number" && saved.page >= 0) {
          setCurrentPage(saved.page);
        }
      }
    } catch {}
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

  useEffect(() => {
    if (!colsHydrated) return;
    try {
      sessionStorage.setItem(
        stateStorageKey,
        JSON.stringify({ filters: filterValues, page: currentPage, pageSize }),
      );
    } catch {}
  }, [filterValues, currentPage, pageSize, colsHydrated, stateStorageKey]);

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  function updateFilter(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  }

  function clearFilters() {
    setFilterValues(emptyFilters);
    setCurrentPage(0);
  }

  return {
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
  };
}

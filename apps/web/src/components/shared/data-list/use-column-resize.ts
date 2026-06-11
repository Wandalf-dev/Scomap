"use client";

import { useState, useRef, useCallback } from "react";

import type { ColumnConfig } from "./types";

export function useColumnResize<TRow>(columns: ColumnConfig<TRow>[]) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const hasFixedWidths = Object.keys(columnWidths).length > 0;
  const actionsColWidth = 50;
  const checkboxColWidth = 48;
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

  return {
    tableRef,
    columnWidths,
    hasFixedWidths,
    totalWidth,
    actionsColWidth,
    checkboxColWidth,
    handleResizeStart,
  };
}

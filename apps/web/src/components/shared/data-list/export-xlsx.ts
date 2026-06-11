import { exportToXlsx } from "@/lib/utils/export-xlsx";

import type { ColumnConfig } from "./types";

interface ExportDataListOptions<TRow> {
  title: string;
  columns: ColumnConfig<TRow>[];
  rows: TRow[];
}

export async function exportDataListToXlsx<TRow>({
  title,
  columns,
  rows,
}: ExportDataListOptions<TRow>) {
  const exportColumns = columns.map((col) => ({
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
    rows,
  });
}

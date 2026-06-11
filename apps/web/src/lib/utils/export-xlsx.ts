import ExcelJS from "exceljs";

export interface ExportColumn<TRow> {
  /** Header label */
  header: string;
  /** Function returning the raw cell value (string/number/Date/null) */
  value: (row: TRow) => string | number | Date | null | undefined;
}

interface ExportOptions<TRow> {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<TRow>[];
  rows: TRow[];
}

// Anti formula-injection: a user-entered value starting with
// = + - @ (or tab/CR) would be interpreted as a formula by Excel/LibreOffice
// when the export is opened. The apostrophe prefix forces text mode.
function sanitizeCell(
  raw: string | number | Date | null,
): string | number | Date | null {
  if (typeof raw === "string" && /^[=+\-@\t\r]/.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * Generates an XLSX file from a column set + row set and triggers a download.
 * Run in the browser only.
 */
export async function exportToXlsx<TRow>({
  filename,
  sheetName = "Export",
  columns,
  rows,
}: ExportOptions<TRow>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Scomap";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: Math.max(12, c.header.length + 2),
  }));

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  // Data rows
  for (const row of rows) {
    const values: Record<string, string | number | Date | null> = {};
    for (const col of columns) {
      const raw = col.value(row);
      values[col.header] = raw === undefined ? null : sanitizeCell(raw);
    }
    sheet.addRow(values);
  }

  // Auto-fit column widths based on content (simple heuristic)
  sheet.columns.forEach((col) => {
    let max = col.width ?? 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const len = v instanceof Date ? 10 : String(v ?? "").length;
      if (len > max) max = Math.min(60, len + 2);
    });
    col.width = max;
  });

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

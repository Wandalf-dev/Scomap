import {
  normalizeDays,
  formatDaysShort,
  type DayEntry,
} from "@/lib/types/day-entry";

export function buildTrajetName(direction: string, days: DayEntry[]): string {
  const label = direction === "aller" ? "Aller" : "Retour";
  return `${label} ${formatDaysShort(days)}`;
}

/**
 * Signature (direction × set of days) of a trajet: matching key between
 * successive versions of the same trajet across avenants. Allows migrating the
 * occurrences (and their one-off customizations) from the old version to the
 * new one.
 */
export function trajetSignature(direction: string, days: DayEntry[]): string {
  const sorted = [...days].sort((a, b) => a.day - b.day);
  return `${direction}|${formatDaysShort(sorted)}`;
}

/** Recurrence days of a trajet as stored (JSON), normalized. */
export function recurrenceDays(recurrence: unknown): DayEntry[] {
  const days = (recurrence as { daysOfWeek?: unknown } | null)?.daysOfWeek;
  return normalizeDays(days as DayEntry[] | null | undefined);
}

/** Previous day's date (YYYY-MM-DD string). */
export function dayBeforeStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

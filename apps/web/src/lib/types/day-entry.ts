import { z } from "zod";

// --- Types ---

export type DayParity = "all" | "even" | "odd";

export interface DayEntry {
  day: number;
  parity: DayParity;
}

// --- Zod Schemas ---

export const dayEntrySchema = z.object({
  day: z.number().min(1).max(7),
  parity: z.enum(["all", "even", "odd"]),
});

// --- Constants ---

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const DAY_LABELS: Record<number, string> = {
  1: "L",
  2: "M",
  3: "Me",
  4: "J",
  5: "V",
  6: "S",
  7: "D",
};

export const DAY_LABELS_FULL: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export const PARITY_LABELS: Record<DayParity, string> = {
  all: "T",
  even: "P",
  odd: "I",
};

// --- Helpers ---

/**
 * Normalize legacy number[] or DayEntry[] from DB into DayEntry[].
 * Legacy format: [1, 2, 3] → [{ day: 1, parity: "all" }, ...]
 */
export function normalizeDays(input: unknown): DayEntry[] {
  if (!input || !Array.isArray(input)) return [];
  if (input.length === 0) return [];

  // Check if it's already DayEntry[] format
  if (typeof input[0] === "object" && input[0] !== null && "day" in input[0]) {
    return input as DayEntry[];
  }

  // Legacy number[] format
  if (typeof input[0] === "number") {
    return (input as number[]).map((day) => ({ day, parity: "all" as const }));
  }

  return [];
}

/**
 * Get ISO week number for a given date.
 * ISO 8601: week 1 contains the first Thursday of the year.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Check if a DayEntry is active for a given date.
 * Checks both the day of week and the week parity.
 */
export function isDayActiveForDate(entry: DayEntry, date: Date): boolean {
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  if (entry.day !== isoDay) return false;
  if (entry.parity === "all") return true;

  const weekNumber = getISOWeekNumber(date);
  if (entry.parity === "even") return weekNumber % 2 === 0;
  return weekNumber % 2 === 1; // odd
}

/**
 * Check if any DayEntry in the array is active for a given date.
 */
export function isAnyDayActiveForDate(entries: DayEntry[], date: Date): boolean {
  return entries.some((entry) => isDayActiveForDate(entry, date));
}

/**
 * Extract unique day numbers from DayEntry[].
 */
export function getDayNumbers(entries: DayEntry[]): number[] {
  return [...new Set(entries.map((e) => e.day))].sort((a, b) => a - b);
}

/**
 * Check if any entry has non-"all" parity.
 */
export function hasParityRules(entries: DayEntry[]): boolean {
  return entries.some((e) => e.parity !== "all");
}

/**
 * Build a display string for days, e.g. "L-M-Me" or "L-Me(P)-V(I)"
 */
export function formatDaysShort(entries: DayEntry[]): string {
  if (!entries.length) return "";
  const sorted = [...entries].sort((a, b) => a.day - b.day);
  return sorted
    .map((e) => {
      const label = DAY_LABELS[e.day] ?? "";
      if (e.parity === "all") return label;
      return `${label}(${PARITY_LABELS[e.parity]})`;
    })
    .join("-");
}

/**
 * Compare two DayEntry arrays for equality (order-independent).
 */
export function areDayEntriesEqual(a: DayEntry[], b: DayEntry[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.day - y.day || x.parity.localeCompare(y.parity));
  const sortedB = [...b].sort((x, y) => x.day - y.day || x.parity.localeCompare(y.parity));
  return sortedA.every(
    (entry, i) => entry.day === sortedB[i]!.day && entry.parity === sortedB[i]!.parity,
  );
}

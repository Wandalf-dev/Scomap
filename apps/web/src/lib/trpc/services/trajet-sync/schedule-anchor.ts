import { type DayEntry } from "@/lib/types/day-entry";

// ISO day (1=Monday … 7=Sunday) -> establishment schedules key.
const SCHEDULE_DAY_KEYS = [
  "",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

export type EtablissementSchedules = Record<
  string,
  { morning?: string | null; evening?: string | null } | null
> | null;

/**
 * Reference time of a trajet derived from the establishment's schedules:
 * morning (opening) for an aller, evening (closing) for a retour. We take the
 * first recurrence day that has a value, otherwise any day.
 */
export function resolveScheduleAnchor(
  schedules: EtablissementSchedules,
  direction: string,
  days: DayEntry[],
): string | null {
  if (!schedules) return null;
  const slot = direction === "aller" ? "morning" : "evening";
  const ordered = [...days.map((d) => d.day)].sort((a, b) => a - b);
  for (const d of ordered) {
    const t = schedules[SCHEDULE_DAY_KEYS[d] ?? ""]?.[slot];
    if (t) return t;
  }
  for (let d = 1; d <= 7; d++) {
    const t = schedules[SCHEDULE_DAY_KEYS[d]!]?.[slot];
    if (t) return t;
  }
  return null;
}

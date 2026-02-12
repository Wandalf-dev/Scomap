/**
 * Get the Monday of the week containing the given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get Monday-Sunday range for a week
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

/**
 * Get first-last day range for a month
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Get all dates in a range (inclusive)
 */
export function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get calendar grid dates for a month view (Monday-aligned, includes overflow)
 */
export function getMonthCalendarDates(date: Date): Date[] {
  const { start, end } = getMonthRange(date);
  // Extend to start on Monday
  const calStart = getWeekStart(start);
  // Extend to end on Sunday
  const calEnd = new Date(end);
  const endDay = calEnd.getDay();
  if (endDay !== 0) {
    calEnd.setDate(calEnd.getDate() + (7 - endDay));
  }
  return getDatesInRange(calStart, calEnd);
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString("fr-FR", {
      ...opts,
      year: "numeric",
    })} - ${end.toLocaleDateString("fr-FR", { ...opts, year: "numeric" })}`;
  }
  return `${start.toLocaleDateString("fr-FR", opts)} - ${end.toLocaleDateString(
    "fr-FR",
    { ...opts, year: "numeric" },
  )}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

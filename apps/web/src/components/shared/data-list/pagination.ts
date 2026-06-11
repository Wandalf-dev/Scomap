export const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000];

/**
 * Returns a compact list of pages to display (0-indexed) with "..." for gaps.
 * Always includes first and last; centers a window around the current page.
 */
export function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | "...")[] = [0];
  const windowStart = Math.max(1, current - 1);
  const windowEnd = Math.min(total - 2, current + 1);
  if (windowStart > 1) pages.push("...");
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
  if (windowEnd < total - 2) pages.push("...");
  pages.push(total - 1);
  return pages;
}

import { cn } from "@/lib/utils";

/** "2026-06-01" → "01/06/2026". */
export function formatAvenantDate(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Today's date (local) as "YYYY-MM-DD", for comparing against effectiveDates. */
export function avenantTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;
}

interface AvenantHead {
  id: string;
  status: string;
  effectiveDate: string;
  circuitSequence: number | null;
}

/**
 * "Current state" = last non-cancelled avenant whose effectiveDate is in the past.
 * (Sorted by effectiveDate descending, then by avenant sequence number.)
 */
export function getHeadAvenantId(
  items: AvenantHead[],
  today: string,
): string | null {
  const past = items
    .filter((a) => a.status !== "annule" && a.effectiveDate <= today)
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        (b.circuitSequence ?? 0) - (a.circuitSequence ?? 0),
    );
  return past[0]?.id ?? null;
}

/**
 * TEMPORAL status badge for an avenant (vs its simple record status):
 * - Annulé   (status = annule)
 * - À venir  (future effectiveDate → not yet in effect)
 * - En cours (latest avenant whose effectiveDate has passed = current state)
 * - Appliqué (past effectiveDate but superseded by a more recent avenant)
 */
export function AvenantStatusBadge({
  id,
  status,
  effectiveDate,
  headId,
  today,
}: {
  id: string;
  status: string;
  effectiveDate: string;
  headId: string | null;
  today: string;
}) {
  let label: string;
  let className: string;
  if (status === "annule") {
    label = "Annulé";
    className =
      "border-border bg-transparent text-muted-foreground line-through";
  } else if (effectiveDate > today) {
    label = "À venir";
    className =
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  } else if (id === headId) {
    label = "En cours";
    className = "border-transparent bg-emerald-600 text-white";
  } else {
    label = "Appliqué";
    className = "border-border bg-muted text-muted-foreground";
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}

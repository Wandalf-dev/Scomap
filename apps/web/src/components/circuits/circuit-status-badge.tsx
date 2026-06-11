import { cn } from "@/lib/utils";
import { CIRCUIT_STATUS_LABELS } from "@/lib/validators/circuit";

// Semantic colors per status (outline style), aligned with the usager badge.
const STATUS_STYLES: Record<string, { dot: string; className: string }> = {
  non_controle: {
    dot: "bg-slate-400",
    className:
      "border-slate-400/40 text-slate-600 dark:border-slate-400/50 dark:text-slate-300",
  },
  controle: {
    dot: "bg-emerald-500",
    className:
      "border-emerald-500/40 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-400",
  },
  modifie: {
    dot: "bg-blue-500",
    className:
      "border-blue-500/40 text-blue-700 dark:border-blue-500/50 dark:text-blue-300",
  },
  en_attente: {
    dot: "bg-amber-500",
    className:
      "border-amber-500/40 text-amber-700 dark:border-amber-500/50 dark:text-amber-300",
  },
};

export function CircuitStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.non_controle;
  const label =
    CIRCUIT_STATUS_LABELS[status as keyof typeof CIRCUIT_STATUS_LABELS] ??
    status;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-transparent px-2 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {label}
    </span>
  );
}

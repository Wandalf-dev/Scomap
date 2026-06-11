import { cn } from "@/lib/utils";
import { USAGER_STATUS_LABELS } from "@/lib/validators/usager";

// Semantic colors per status, outline style: transparent background, thin border
// in the hue (stronger in dark mode), tinted label and vivid dot.
const STATUS_STYLES: Record<string, { dot: string; className: string }> = {
  non_controle: {
    dot: "bg-slate-400",
    className: "border-slate-400/40 text-slate-600 dark:border-slate-400/50 dark:text-slate-300",
  },
  controle: {
    dot: "bg-emerald-500",
    className: "border-emerald-500/40 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-400",
  },
  modifie: {
    dot: "bg-blue-500",
    className: "border-blue-500/40 text-blue-700 dark:border-blue-500/50 dark:text-blue-300",
  },
  en_attente: {
    dot: "bg-amber-500",
    className: "border-amber-500/40 text-amber-700 dark:border-amber-500/50 dark:text-amber-300",
  },
  refuse_annule: {
    dot: "bg-red-500",
    className: "border-red-500/40 text-red-700 dark:border-red-500/50 dark:text-red-400",
  },
  a_reconduire: {
    dot: "bg-violet-500",
    className: "border-violet-500/40 text-violet-700 dark:border-violet-500/50 dark:text-violet-300",
  },
};

export function UsagerStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.non_controle;
  const label =
    USAGER_STATUS_LABELS[status as keyof typeof USAGER_STATUS_LABELS] ?? status;
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

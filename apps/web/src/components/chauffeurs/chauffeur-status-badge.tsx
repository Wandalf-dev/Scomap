import { cn } from "@/lib/utils";

// Active/inactive driver badge — outline style aligned with the usager and
// circuit status badges (transparent bg, thin hued border, vivid dot).
const STYLES = {
  active: {
    dot: "bg-emerald-500",
    className:
      "border-emerald-500/40 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-400",
  },
  inactive: {
    dot: "bg-slate-400",
    className:
      "border-slate-400/40 text-slate-600 dark:border-slate-400/50 dark:text-slate-300",
  },
} as const;

export function ChauffeurStatusBadge({ isActive }: { isActive: boolean }) {
  const style = isActive ? STYLES.active : STYLES.inactive;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-transparent px-2 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {isActive ? "Actif" : "Inactif"}
    </span>
  );
}

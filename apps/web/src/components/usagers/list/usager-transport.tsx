import { cn } from "@/lib/utils";
import {
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";

// Short labels for compact contexts (stat chips).
export const USAGER_TRANSPORT_SHORT: Record<string, string> = {
  taxi_collectif_individuel: "Taxi",
  transport_famille: "Famille",
  transport_commun: "Commun",
};

// Swatch color per transport type — same hues as the row accent bar
// (carried over from Transcolaire's color coding).
export const USAGER_TRANSPORT_SWATCH: Record<string, string> = {
  taxi_collectif_individuel: "bg-blue-500",
  transport_famille: "bg-orange-500",
  transport_commun: "bg-amber-500",
};

/** Transport type as a colored-swatch chip (full label). */
export function UsagerTransportChip({ type }: { type: string }) {
  const label =
    USAGER_TRANSPORT_TYPE_LABELS[
      type as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
    ] ?? type;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground">
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-[3px]",
          USAGER_TRANSPORT_SWATCH[type] ?? "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

interface StatChipsProps {
  counts: Record<string, number>;
  /** Active transport filter value ("all" or a transport type). */
  activeType: string;
  onToggle: (type: string) => void;
}

/**
 * Per-transport-type distribution chips above the table; clicking one toggles
 * the transport column filter (quick filter, like the legacy recap counts).
 */
export function UsagerTransportStatChips({
  counts,
  activeType,
  onToggle,
}: StatChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {USAGER_TRANSPORT_TYPES.map((type) => {
        const active = activeType === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(active ? "all" : type)}
            title={`Filtrer : ${USAGER_TRANSPORT_TYPE_LABELS[type]}`}
            aria-pressed={active}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
              active
                ? "border-primary bg-primary/5 text-foreground ring-1 ring-inset ring-primary"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                USAGER_TRANSPORT_SWATCH[type],
              )}
              aria-hidden
            />
            {USAGER_TRANSPORT_SHORT[type]}
            <b className="font-semibold tabular-nums text-foreground">
              {counts[type] ?? 0}
            </b>
          </button>
        );
      })}
    </div>
  );
}

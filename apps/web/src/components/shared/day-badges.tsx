import { Badge } from "@/components/ui/badge";
import {
  ALL_DAYS,
  DAY_LABELS,
  PARITY_LABELS,
  normalizeDays,
  type DayEntry,
} from "@/lib/types/day-entry";

interface DayBadgesProps {
  days: DayEntry[] | number[] | null;
  label?: string;
}

export function DayBadges({ days, label }: DayBadgesProps) {
  const entries = normalizeDays(days);

  if (entries.length === 0) {
    return <span className="text-muted-foreground/60">&mdash;</span>;
  }

  const entryMap = new Map(entries.map((e) => [e.day, e]));

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <div className="flex gap-0.5">
        {ALL_DAYS.map((d) => {
          const entry = entryMap.get(d);
          const isActive = !!entry;
          const showParity = entry && entry.parity !== "all";
          const badgeLabel = showParity
            ? `${DAY_LABELS[d]}${PARITY_LABELS[entry.parity]}`
            : DAY_LABELS[d];

          return (
            <Badge
              key={d}
              variant={isActive ? "default" : "outline"}
              className={`h-5 justify-center px-0 text-[10px] ${
                isActive
                  ? showParity
                    ? "w-8"
                    : "w-6"
                  : "w-6 border-border/50 text-muted-foreground/40"
              }`}
              title={
                entry
                  ? entry.parity === "all"
                    ? "Toutes les semaines"
                    : entry.parity === "even"
                      ? "Semaines paires"
                      : "Semaines impaires"
                  : undefined
              }
            >
              {badgeLabel}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

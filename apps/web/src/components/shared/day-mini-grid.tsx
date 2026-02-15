import { cn } from "@/lib/utils";
import {
  ALL_DAYS,
  DAY_LABELS,
  DAY_LABELS_FULL,
  normalizeDays,
  type DayEntry,
} from "@/lib/types/day-entry";

interface DayMiniGridProps {
  days: DayEntry[] | number[] | null;
  color?: "orange" | "blue";
}

function isActive(entries: DayEntry[], day: number, parity: "even" | "odd"): boolean {
  const entry = entries.find((e) => e.day === day);
  if (!entry) return false;
  return entry.parity === "all" || entry.parity === parity;
}

const PARITY_LABEL: Record<string, string> = { even: "P", odd: "I" };
const parities: ("even" | "odd")[] = ["even", "odd"];

export function DayMiniGrid({ days, color = "orange" }: DayMiniGridProps) {
  const entries = normalizeDays(days);

  const colorOn = color === "orange"
    ? "bg-amber-500 dark:bg-orange-500"
    : "bg-blue-500 dark:bg-blue-400";

  const colorOff = "bg-muted/60 dark:bg-[#44403c]";

  return (
    <div className="inline-flex flex-col gap-px">
      {parities.map((parity) => (
        <div key={parity} className="flex items-center gap-1">
          <span className="text-[8px] font-semibold text-muted-foreground w-2">
            {PARITY_LABEL[parity]}
          </span>
          <div className="flex gap-px">
            {ALL_DAYS.map((d) => {
              const on = isActive(entries, d, parity);
              return (
                <div
                  key={`${d}-${parity}`}
                  className={cn(
                    "size-4 rounded-[2px] flex items-center justify-center text-[7px] font-semibold",
                    on ? cn(colorOn, "text-white") : cn(colorOff, "text-muted-foreground/50"),
                  )}
                  title={`${DAY_LABELS_FULL[d]} (sem. ${parity === "even" ? "paire" : "impaire"}) — ${on ? "Actif" : "Inactif"}`}
                >
                  {DAY_LABELS[d]}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

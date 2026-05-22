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
  color?: "aller" | "retour" | "orange" | "blue";
}

function isActive(entries: DayEntry[], day: number, parity: "even" | "odd"): boolean {
  const entry = entries.find((e) => e.day === day);
  if (!entry) return false;
  return entry.parity === "all" || entry.parity === parity;
}

const PARITY_LABEL: Record<string, string> = { even: "P", odd: "I" };
const parities: ("even" | "odd")[] = ["even", "odd"];

export function DayMiniGrid({ days, color = "aller" }: DayMiniGridProps) {
  const entries = normalizeDays(days);

  // Backwards compat: "orange" → "aller", "blue" → "retour"
  const variant = color === "orange" ? "aller" : color === "blue" ? "retour" : color;

  const colorOn =
    variant === "aller"
      ? "bg-primary text-primary-foreground"
      : "bg-foreground/85 text-background";

  const colorOff = "bg-muted/40";

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
                    on ? colorOn : cn(colorOff, "text-muted-foreground/50"),
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

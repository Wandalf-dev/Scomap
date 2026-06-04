"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ALL_DAYS, DAY_LABELS, type DayEntry } from "@/lib/types/day-entry";

interface DaySelectorProps {
  value: DayEntry[];
  onChange: (days: DayEntry[]) => void;
}

/**
 * Day-of-week selector as a Paires / Impaires matrix (even/odd ISO weeks).
 * - Both boxes checked -> runs every week  (parity "all")
 * - Only "Paires"      -> even weeks only   (parity "even")
 * - Only "Impaires"    -> odd weeks only    (parity "odd")
 * - Neither            -> day not selected
 * Clicking a day header toggles the whole column (every week / off).
 */
export function DaySelector({ value, onChange }: DaySelectorProps) {
  const getEntry = (day: number) => value.find((e) => e.day === day);

  const state = (day: number): { paire: boolean; impaire: boolean } => {
    const e = getEntry(day);
    if (!e) return { paire: false, impaire: false };
    if (e.parity === "all") return { paire: true, impaire: true };
    if (e.parity === "even") return { paire: true, impaire: false };
    return { paire: false, impaire: true }; // odd
  };

  function apply(day: number, paire: boolean, impaire: boolean) {
    const rest = value.filter((e) => e.day !== day);
    if (paire && impaire) rest.push({ day, parity: "all" });
    else if (paire) rest.push({ day, parity: "even" });
    else if (impaire) rest.push({ day, parity: "odd" });
    onChange(rest.sort((a, b) => a.day - b.day));
  }

  function toggle(day: number, row: "paire" | "impaire", checked: boolean) {
    const s = state(day);
    if (row === "paire") apply(day, checked, s.impaire);
    else apply(day, s.paire, checked);
  }

  function toggleColumn(day: number) {
    const s = state(day);
    const anyOn = s.paire || s.impaire;
    apply(day, !anyOn, !anyOn);
  }

  return (
    <div className="space-y-2">
      <div className="inline-grid grid-cols-[auto_repeat(7,2.25rem)] items-center gap-x-1 gap-y-1.5 rounded-[0.3rem] border border-border bg-muted/20 p-2">
        {/* Header: clickable day labels */}
        <div />
        {ALL_DAYS.map((d) => {
          const active = state(d).paire || state(d).impaire;
          return (
            <button
              key={`h-${d}`}
              type="button"
              onClick={() => toggleColumn(d)}
              title="Cocher / décocher ce jour (toutes les semaines)"
              className={`cursor-pointer rounded-[0.3rem] py-0.5 text-xs font-semibold transition-colors hover:bg-muted ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          );
        })}

        {/* Paires row */}
        <span className="pr-2 text-right text-xs font-medium text-muted-foreground">
          Paires
        </span>
        {ALL_DAYS.map((d) => (
          <div key={`p-${d}`} className="flex justify-center">
            <Checkbox
              checked={state(d).paire}
              onCheckedChange={(c) => toggle(d, "paire", !!c)}
              className="cursor-pointer"
              aria-label={`${DAY_LABELS[d]} — semaines paires`}
            />
          </div>
        ))}

        {/* Impaires row */}
        <span className="pr-2 text-right text-xs font-medium text-muted-foreground">
          Impaires
        </span>
        {ALL_DAYS.map((d) => (
          <div key={`i-${d}`} className="flex justify-center">
            <Checkbox
              checked={state(d).impaire}
              onCheckedChange={(c) => toggle(d, "impaire", !!c)}
              className="cursor-pointer"
              aria-label={`${DAY_LABELS[d]} — semaines impaires`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Cochez Paires + Impaires pour toutes les semaines. Clic sur un jour pour
        basculer la colonne.
      </p>
    </div>
  );
}

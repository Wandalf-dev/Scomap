"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_DAYS,
  DAY_LABELS,
  type DayEntry,
  type DayParity,
} from "@/lib/types/day-entry";

interface DaySelectorProps {
  value: DayEntry[];
  onChange: (days: DayEntry[]) => void;
  showToggleAll?: boolean;
}

const PARITY_OPTIONS: { value: DayParity; label: string }[] = [
  { value: "all", label: "T" },
  { value: "even", label: "P" },
  { value: "odd", label: "I" },
];

export function DaySelector({
  value,
  onChange,
  showToggleAll = false,
}: DaySelectorProps) {
  const getEntry = (day: number) => value.find((e) => e.day === day);
  const isChecked = (day: number) => !!getEntry(day);

  function toggleDay(day: number, checked: boolean) {
    if (checked) {
      onChange([...value, { day, parity: "all" as const }].sort((a, b) => a.day - b.day));
    } else {
      onChange(value.filter((e) => e.day !== day));
    }
  }

  function setParity(day: number, parity: DayParity) {
    onChange(
      value.map((e) => (e.day === day ? { ...e, parity } : e)),
    );
  }

  function toggleAll() {
    if (value.length === ALL_DAYS.length) {
      onChange([]);
    } else {
      onChange(ALL_DAYS.map((day) => ({ day, parity: "all" as const })));
    }
  }

  return (
    <div className="space-y-2">
      {showToggleAll && (
        <div className="flex justify-end">
          <button
            type="button"
            className="cursor-pointer text-xs text-primary hover:underline"
            onClick={toggleAll}
          >
            {value.length === ALL_DAYS.length ? "Aucun" : "Tous"}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        {ALL_DAYS.map((day) => {
          const checked = isChecked(day);
          const entry = getEntry(day);
          return (
            <div key={day} className="flex flex-col items-center gap-1.5">
              <label className="flex cursor-pointer flex-col items-center gap-1.5">
                <Checkbox
                  checked={checked}
                  className="h-6 w-6 cursor-pointer"
                  onCheckedChange={(c) => toggleDay(day, !!c)}
                />
                <span className="cursor-pointer text-xs text-muted-foreground">
                  {DAY_LABELS[day]}
                </span>
              </label>
              {checked && (
                <div className="flex gap-0.5">
                  {PARITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`cursor-pointer rounded-[0.3rem] px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        entry?.parity === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      onClick={() => setParity(day, opt.value)}
                      title={
                        opt.value === "all"
                          ? "Toutes les semaines"
                          : opt.value === "even"
                            ? "Semaines paires"
                            : "Semaines impaires"
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

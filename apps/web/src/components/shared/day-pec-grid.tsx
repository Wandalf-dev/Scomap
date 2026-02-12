"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_DAYS,
  DAY_LABELS,
  type DayEntry,
} from "@/lib/types/day-entry";

interface DayPecGridProps {
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  onChangeAller: (days: DayEntry[]) => void;
  onChangeRetour: (days: DayEntry[]) => void;
}

type RowParity = "even" | "odd";

function isChecked(
  days: DayEntry[],
  day: number,
  rowParity: RowParity,
): boolean {
  const entry = days.find((e) => e.day === day);
  if (!entry) return false;
  return entry.parity === "all" || entry.parity === rowParity;
}

function toggleCell(
  days: DayEntry[],
  day: number,
  rowParity: RowParity,
  checked: boolean,
): DayEntry[] {
  const otherParity: RowParity = rowParity === "even" ? "odd" : "even";
  const entry = days.find((e) => e.day === day);
  const otherChecked = entry
    ? entry.parity === "all" || entry.parity === otherParity
    : false;

  const filtered = days.filter((e) => e.day !== day);

  if (checked && otherChecked) {
    filtered.push({ day, parity: "all" });
  } else if (checked) {
    filtered.push({ day, parity: rowParity });
  } else if (otherChecked) {
    filtered.push({ day, parity: otherParity });
  }

  return filtered.sort((a, b) => a.day - b.day);
}

export function DayPecGrid({
  daysAller,
  daysRetour,
  onChangeAller,
  onChangeRetour,
}: DayPecGridProps) {
  const allChecked = ALL_DAYS.every((day) => {
    const a = daysAller.find((e) => e.day === day);
    const r = daysRetour.find((e) => e.day === day);
    return a?.parity === "all" && r?.parity === "all";
  });

  function handleToggleAll() {
    if (allChecked) {
      onChangeAller([]);
      onChangeRetour([]);
    } else {
      const all = ALL_DAYS.map((day) => ({ day, parity: "all" as const }));
      onChangeAller(all);
      onChangeRetour(all);
    }
  }

  const columns = ALL_DAYS.flatMap((day) => [
    { day, dir: "aller" as const },
    { day, dir: "retour" as const },
  ]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Jours de prise en charge</span>
        <button
          type="button"
          className="cursor-pointer text-xs text-primary hover:underline"
          onClick={handleToggleAll}
        >
          {allChecked ? "Aucun" : "Tous"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-[0.3rem] border border-border">
        <table className="w-full border-collapse text-center text-[11px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-6 border-r border-border" />
              {ALL_DAYS.map((day, i) => (
                <th
                  key={day}
                  colSpan={2}
                  className={`py-1 font-medium text-foreground${
                    i < ALL_DAYS.length - 1 ? " border-r border-border" : ""
                  }`}
                >
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th className="border-r border-border" />
              {columns.map((col) => (
                <th
                  key={`${col.day}-${col.dir}`}
                  className={`px-0.5 py-0.5 font-normal text-muted-foreground${
                    col.dir === "retour" && col.day < 7
                      ? " border-r border-border"
                      : ""
                  }`}
                >
                  {col.dir === "aller" ? "a" : "r"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["even", "odd"] as const).map((parity, rowIdx) => (
              <tr
                key={parity}
                className={rowIdx === 0 ? "border-b border-border" : ""}
              >
                <td className="border-r border-border py-0.5 font-medium text-muted-foreground">
                  {parity === "even" ? "P" : "I"}
                </td>
                {columns.map((col) => {
                  const days =
                    col.dir === "aller" ? daysAller : daysRetour;
                  const onChange =
                    col.dir === "aller" ? onChangeAller : onChangeRetour;
                  const checked = isChecked(days, col.day, parity);
                  return (
                    <td
                      key={`${col.day}-${col.dir}-${parity}`}
                      className={`px-0.5 py-0.5${
                        col.dir === "retour" && col.day < 7
                          ? " border-r border-border"
                          : ""
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        className="h-[18px] w-[18px] cursor-pointer"
                        onCheckedChange={(c) =>
                          onChange(
                            toggleCell(days, col.day, parity, !!c),
                          )
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_DAYS, DAY_LABELS, type DayEntry } from "@/lib/types/day-entry";

type RowParity = "even" | "odd";

function isChecked(days: DayEntry[], day: number, parity: RowParity): boolean {
  const e = days.find((x) => x.day === day);
  if (!e) return false;
  return e.parity === "all" || e.parity === parity;
}

const ROWS: { key: RowParity; label: string; title: string }[] = [
  { key: "even", label: "P", title: "Semaines paires" },
  { key: "odd", label: "I", title: "Semaines impaires" },
];

/**
 * READ-ONLY day grid, table format: header L M Me J V S D
 * + rows P (even weeks) / I (odd weeks) with checkmarks. (Circuit recap display.)
 */
export function DayChecksTable({ days }: { days: DayEntry[] }) {
  return (
    <table className="w-56 table-fixed border-collapse text-[11px] leading-none">
      <thead>
        <tr>
          <th className="size-7 border border-border bg-muted" />
          {ALL_DAYS.map((d) => {
            const weekend = d >= 6;
            return (
              <th
                key={d}
                className={cn(
                  "size-7 border border-border text-center font-bold",
                  weekend
                    ? "bg-muted/40 text-muted-foreground/45"
                    : "bg-muted text-foreground",
                )}
              >
                {DAY_LABELS[d]}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.key}>
            <th
              title={row.title}
              className="size-7 border border-border bg-muted text-center font-bold text-foreground"
            >
              {row.label}
            </th>
            {ALL_DAYS.map((d) => {
              const on = isChecked(days, d, row.key);
              const weekend = d >= 6;
              return (
                <td
                  key={d}
                  className={cn(
                    "size-7 border border-border p-0 text-center",
                    on
                      ? "bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                      : weekend
                        ? "bg-muted/40"
                        : "bg-card",
                  )}
                >
                  {on && (
                    <Check
                      className="mx-auto size-4 text-primary-foreground"
                      strokeWidth={3.4}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

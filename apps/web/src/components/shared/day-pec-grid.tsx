"use client";

import NextLink from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import {
  ALL_DAYS,
  DAY_LABELS,
  DAY_LABELS_FULL,
  type DayEntry,
} from "@/lib/types/day-entry";

type RowParity = "even" | "odd";

export interface OccupiedDay {
  day: number;
  parity: "all" | "even" | "odd";
  label: string;
}

interface DayPecGridProps {
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  occupiedAller?: OccupiedDay[];
  occupiedRetour?: OccupiedDay[];
  /** Controlled component: emitted on every change (the parent manages the draft and saving). */
  onChange: (aller: DayEntry[], retour: DayEntry[]) => void;
  /** Read-only: days visible but not editable (e.g. usager assigned to a circuit). */
  readOnly?: boolean;
  /** Resolution link displayed when readOnly (avenant creation). */
  lockHref?: string;
}

function isChecked(days: DayEntry[], day: number, rowParity: RowParity): boolean {
  const entry = days.find((e) => e.day === day);
  if (!entry) return false;
  return entry.parity === "all" || entry.parity === rowParity;
}

function isOccupied(occupied: OccupiedDay[], day: number, rowParity: RowParity): OccupiedDay | undefined {
  return occupied.find(
    (o) => o.day === day && (o.parity === "all" || o.parity === rowParity),
  );
}

function toggleCell(days: DayEntry[], day: number, rowParity: RowParity, checked: boolean): DayEntry[] {
  const otherParity: RowParity = rowParity === "even" ? "odd" : "even";
  const entry = days.find((e) => e.day === day);
  const otherChecked = entry ? entry.parity === "all" || entry.parity === otherParity : false;
  const filtered = days.filter((e) => e.day !== day);

  if (checked && otherChecked) filtered.push({ day, parity: "all" });
  else if (checked) filtered.push({ day, parity: rowParity });
  else if (otherChecked) filtered.push({ day, parity: otherParity });

  return filtered.sort((a, b) => a.day - b.day);
}

function isRowAllChecked(days: DayEntry[], parity: RowParity): boolean {
  return ALL_DAYS.every((day) => isChecked(days, day, parity));
}

function toggleRow(days: DayEntry[], parity: RowParity, check: boolean): DayEntry[] {
  let result = [...days];
  for (const day of ALL_DAYS) result = toggleCell(result, day, parity, check);
  return result;
}

function allOn(): DayEntry[] {
  return ALL_DAYS.map((day) => ({ day, parity: "all" as const }));
}

function isAllOn(days: DayEntry[]): boolean {
  return ALL_DAYS.every((day) => days.find((e) => e.day === day)?.parity === "all");
}

function findBlockedDays(
  occupied: OccupiedDay[],
  days: number[],
  parity: RowParity,
): OccupiedDay | undefined {
  for (const day of days) {
    const o = isOccupied(occupied, day, parity);
    if (o) return o;
  }
  return undefined;
}

const PARITIES: RowParity[] = ["even", "odd"];
const PARITY_LABEL: Record<RowParity, string> = { even: "Paire", odd: "Impaire" };
const PARITY_SUBLABEL: Record<RowParity, string> = {
  even: "sem. paires",
  odd: "sem. impaires",
};

function Cell({
  on,
  locked,
  readOnly = false,
  color,
  onClick,
}: {
  on: boolean;
  locked: boolean;
  readOnly?: boolean;
  color: "aller" | "retour";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onClick}
      className={cn(
        "relative flex size-8 items-center justify-center rounded-[9px] transition-all",
        // Day occupied by another address
        locked && "cursor-not-allowed border border-border bg-muted/40",
        readOnly && !locked && "cursor-not-allowed",
        !locked && !readOnly && "cursor-pointer",
        // Aller active: filled accent cell
        on && !locked && color === "aller" &&
          "border border-primary bg-primary shadow-sm shadow-primary/20",
        // Retour active: accent ring on card background
        on && !locked && color === "retour" &&
          "border-2 border-primary bg-card",
        // Off: plain cell on card background
        !on && !locked && "border border-border bg-card",
        !on && !locked && !readOnly && "hover:border-border hover:bg-muted/40",
      )}
    >
      {locked ? (
        <Lock className="size-3 text-muted-foreground/40" />
      ) : on ? (
        <Check
          className={cn(
            color === "aller"
              ? "size-4 text-primary-foreground"
              // Retour ring: purple checkmark in light mode, white in dark mode (readability — primary is dark in dark mode)
              : "size-[15px] text-primary dark:text-primary-foreground",
          )}
        />
      ) : (
        <span className="size-1 rounded-full bg-muted-foreground/30" />
      )}
    </button>
  );
}

function RowCheck({
  on,
  onClick,
  label,
  subLabel,
  readOnly = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  subLabel: string;
  readOnly?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 text-left",
        readOnly ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
        !on && !readOnly && "group-hover:border-primary/60",
      )}>
        {on && <Check className="size-3" />}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn(
          "text-xs font-semibold text-foreground/80 transition-colors",
          !readOnly && "group-hover:text-foreground",
        )}>
          {label}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {subLabel}
        </span>
      </span>
    </button>
  );
}

function DirectionBlock({
  label,
  color,
  days,
  occupied,
  onChange,
  readOnly = false,
}: {
  label: string;
  color: "aller" | "retour";
  days: DayEntry[];
  occupied: OccupiedDay[];
  onChange: (days: DayEntry[]) => void;
  readOnly?: boolean;
}) {
  function handleCellClick(day: number, parity: RowParity) {
    if (readOnly) return;
    const alreadyOn = isChecked(days, day, parity);
    if (alreadyOn) {
      onChange(toggleCell(days, day, parity, false));
      return;
    }
    const conflict = isOccupied(occupied, day, parity);
    if (conflict) {
      const parityStr = parity === "even" ? "sem. paire" : "sem. impaire";
      toast.error(
        `${DAY_LABELS_FULL[day]} (${parityStr}) est déjà pris par ${conflict.label}`,
      );
      return;
    }
    onChange(toggleCell(days, day, parity, true));
  }

  function handleRowToggle(parity: RowParity) {
    if (readOnly) return;
    const rowAll = isRowAllChecked(days, parity);
    if (rowAll) {
      onChange(toggleRow(days, parity, false));
      return;
    }
    const uncheckedDays = ALL_DAYS.filter((d) => !isChecked(days, d, parity));
    const conflict = findBlockedDays(occupied, uncheckedDays, parity);
    if (conflict) {
      const parityStr = parity === "even" ? "sem. paire" : "sem. impaire";
      toast.error(
        `${DAY_LABELS_FULL[conflict.day]} (${parityStr}) est déjà pris par ${conflict.label}`,
      );
      return;
    }
    onChange(toggleRow(days, parity, true));
  }

  const DirectionIcon = color === "aller" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-[22px] items-center justify-center rounded-md bg-primary/10 text-primary">
          <DirectionIcon className="size-3.5" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          {label}
        </span>
      </div>

      <div className="flex items-center">
        <div className="w-20 shrink-0" />
        <div className="flex gap-1">
          {ALL_DAYS.map((day) => (
            <span key={day} className="size-8 text-center text-[11px] font-bold leading-8 text-muted-foreground">
              {DAY_LABELS[day]}
            </span>
          ))}
        </div>
      </div>

      {PARITIES.map((parity) => {
        const rowAll = isRowAllChecked(days, parity);
        return (
          <div key={parity} className="flex items-center">
            <div className="w-20 shrink-0">
              <RowCheck
                on={rowAll}
                onClick={() => handleRowToggle(parity)}
                label={PARITY_LABEL[parity]}
                subLabel={PARITY_SUBLABEL[parity]}
                readOnly={readOnly}
              />
            </div>
            <div className="flex gap-1">
              {ALL_DAYS.map((day) => (
                <Cell
                  key={`${day}-${parity}`}
                  color={color}
                  on={isChecked(days, day, parity)}
                  locked={!isChecked(days, day, parity) && !!isOccupied(occupied, day, parity)}
                  readOnly={readOnly}
                  onClick={() => handleCellClick(day, parity)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DayPecGrid({
  daysAller,
  daysRetour,
  occupiedAller = [],
  occupiedRetour = [],
  onChange,
  readOnly = false,
  lockHref,
}: DayPecGridProps) {
  const everythingOn = isAllOn(daysAller) && isAllOn(daysRetour);

  function handleAller(days: DayEntry[]) {
    onChange(days, daysRetour);
  }

  function handleRetour(days: DayEntry[]) {
    onChange(daysAller, days);
  }

  function handleToggleAll() {
    if (readOnly) return;
    if (everythingOn) {
      onChange([], []);
      return;
    }
    const allOccupied = [...occupiedAller, ...occupiedRetour];
    if (allOccupied.length > 0) {
      toast.error("Certains jours sont déjà pris par une autre adresse");
      return;
    }
    const days = allOn();
    onChange(days, days);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Jours de prise en charge</span>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-[5px] bg-primary" />
                  Aller
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-[5px] border-2 border-primary bg-card" />
                  Retour
                </span>
              </div>
              <span className="h-3.5 w-px bg-border" />
            </>
          )}
          {readOnly ? (
            lockHref ? (
              <NextLink
                href={lockHref}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Lock className="size-3" />
                Verrouillé — modifiable via un avenant
              </NextLink>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Lock className="size-3" />
                Verrouillé
              </span>
            )
          ) : (
            <button
              type="button"
              className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
              onClick={handleToggleAll}
            >
              {everythingOn ? "Tout décocher" : "Tout cocher"}
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex gap-4 rounded-xl border border-border bg-muted/30 p-4", readOnly && "opacity-90")}>
        <DirectionBlock label="Aller" color="aller" days={daysAller} occupied={occupiedAller} onChange={handleAller} readOnly={readOnly} />
        <div className="w-px shrink-0 bg-border" />
        <DirectionBlock label="Retour" color="retour" days={daysRetour} occupied={occupiedRetour} onChange={handleRetour} readOnly={readOnly} />
      </div>
    </div>
  );
}

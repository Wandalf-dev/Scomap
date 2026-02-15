"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  onSave: (aller: DayEntry[], retour: DayEntry[]) => void;
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

function Cell({
  on,
  locked,
  color,
  onClick,
}: {
  on: boolean;
  locked: boolean;
  color: "orange" | "blue";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "size-8 rounded-[3px] transition-colors relative",
        locked
          ? "bg-muted/40 dark:bg-[#44403c] cursor-not-allowed"
          : "cursor-pointer",
        on && !locked
          ? color === "orange"
            ? "bg-amber-500 dark:bg-orange-500"
            : "bg-blue-500 dark:bg-blue-400"
          : !locked && "bg-muted dark:bg-[#44403c] hover:bg-muted-foreground/15 dark:hover:bg-[#57534e]",
      )}
    >
      {locked && (
        <Lock className="size-3 text-muted-foreground/50 absolute inset-0 m-auto" />
      )}
    </button>
  );
}

function RowCheck({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 cursor-pointer group"
    >
      <span className={cn(
        "size-4 rounded-[3px] border flex items-center justify-center transition-colors",
        on
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/40 group-hover:border-primary/60",
      )}>
        {on && <Check className="size-3" />}
      </span>
      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
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
}: {
  label: string;
  color: "orange" | "blue";
  days: DayEntry[];
  occupied: OccupiedDay[];
  onChange: (days: DayEntry[]) => void;
}) {
  function handleCellClick(day: number, parity: RowParity) {
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

  return (
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-3 mb-1">
        <span className={cn(
          "text-[11px] font-bold uppercase tracking-widest",
          color === "orange" ? "text-amber-600 dark:text-orange-400" : "text-blue-500 dark:text-blue-400",
        )}>
          {label}
        </span>
      </div>

      <div className="flex items-center">
        <div className="w-20 shrink-0" />
        <div className="flex gap-1">
          {ALL_DAYS.map((day) => (
            <span key={day} className="size-8 text-center text-[10px] font-semibold text-muted-foreground leading-8">
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
              />
            </div>
            <div className="flex gap-1">
              {ALL_DAYS.map((day) => (
                <Cell
                  key={`${day}-${parity}`}
                  color={color}
                  on={isChecked(days, day, parity)}
                  locked={!isChecked(days, day, parity) && !!isOccupied(occupied, day, parity)}
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
  onSave,
}: DayPecGridProps) {
  const [localAller, setLocalAller] = useState(daysAller);
  const [localRetour, setLocalRetour] = useState(daysRetour);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestAller = useRef(localAller);
  const latestRetour = useRef(localRetour);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => { if (!dirty.current) setLocalAller(daysAller); }, [daysAller]);
  useEffect(() => { if (!dirty.current) setLocalRetour(daysRetour); }, [daysRetour]);

  const flush = useCallback(() => {
    onSaveRef.current(latestAller.current, latestRetour.current);
    setTimeout(() => { dirty.current = false; }, 3000);
  }, []);

  function schedule() {
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }

  function handleAller(days: DayEntry[]) {
    dirty.current = true;
    latestAller.current = days;
    setLocalAller(days);
    schedule();
  }

  function handleRetour(days: DayEntry[]) {
    dirty.current = true;
    latestRetour.current = days;
    setLocalRetour(days);
    schedule();
  }

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (dirty.current) flush();
  }, [flush]);

  const everythingOn = isAllOn(localAller) && isAllOn(localRetour);

  function handleToggleAll() {
    if (everythingOn) {
      dirty.current = true;
      latestAller.current = [];
      latestRetour.current = [];
      setLocalAller([]);
      setLocalRetour([]);
      schedule();
      return;
    }
    const allOccupied = [...occupiedAller, ...occupiedRetour];
    if (allOccupied.length > 0) {
      toast.error("Certains jours sont déjà pris par une autre adresse");
      return;
    }
    const days = allOn();
    dirty.current = true;
    latestAller.current = days;
    latestRetour.current = days;
    setLocalAller(days);
    setLocalRetour(days);
    schedule();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Jours de prise en charge</span>
        <button
          type="button"
          className="cursor-pointer text-[11px] text-primary hover:underline font-medium"
          onClick={handleToggleAll}
        >
          {everythingOn ? "Tout décocher" : "Tout cocher"}
        </button>
      </div>

      <div className="flex gap-4 rounded-lg border bg-accent p-4">
        <DirectionBlock label="Aller" color="orange" days={localAller} occupied={occupiedAller} onChange={handleAller} />
        <div className="w-px bg-border shrink-0" />
        <DirectionBlock label="Retour" color="blue" days={localRetour} occupied={occupiedRetour} onChange={handleRetour} />
      </div>
    </div>
  );
}

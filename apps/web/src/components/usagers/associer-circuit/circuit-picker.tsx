"use client";

import { useState } from "react";
import {
  Route,
  Search,
  Sparkles,
  Check,
  Users,
  CalendarRange,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCircuitPeriode } from "./helpers";
import { SuggestionReasonChip, RelevanceTag } from "./suggestion-chips";
import type { CircuitListItem, CircuitSuggestion } from "./types";

// --- Circuit row ---

function CircuitRow({
  circuit,
  suggestion,
  selected,
  onSelect,
}: {
  circuit: CircuitListItem;
  suggestion?: CircuitSuggestion;
  selected: boolean;
  onSelect: () => void;
}) {
  const subline = [circuit.etablissementName, circuit.etablissementCity]
    .filter(Boolean)
    .join(" · ");
  const periode =
    circuit.startDate || circuit.endDate
      ? formatCircuitPeriode(circuit.startDate, circuit.endDate)
      : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 border-l-2 px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-l-primary bg-primary/[0.06]"
          : "border-l-transparent hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        <Route className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {circuit.name}
        </span>
        {subline && (
          <span className="block truncate text-xs text-muted-foreground">
            {subline}
          </span>
        )}
        {/* Practical info: validity period + number of assigned usagers. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {periode && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarRange className="size-3 shrink-0" />
              {periode}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3 shrink-0" />
            {circuit.usagerCount} usager{circuit.usagerCount > 1 ? "s" : ""}
          </span>
        </span>
        {suggestion && suggestion.reasons.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {suggestion.reasons.map((r, i) => (
              <SuggestionReasonChip key={i} reason={r} />
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        {suggestion && <RelevanceTag score={suggestion.score} />}
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full border-2",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
      </span>
    </button>
  );
}

// --- Picker (Suggestions / Others blocks) ---

interface CircuitPickerProps {
  availableCircuits: CircuitListItem[];
  suggestions?: CircuitSuggestion[];
  suggestionsLoading?: boolean;
  value: string;
  onSelect: (id: string) => void;
}

export function CircuitPicker({
  availableCircuits,
  suggestions,
  suggestionsLoading,
  value,
  onSelect,
}: CircuitPickerProps) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? availableCircuits.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.etablissementName?.toLowerCase().includes(q) ?? false) ||
          (c.etablissementCity?.toLowerCase().includes(q) ?? false),
      )
    : availableCircuits;

  const suggMap = new Map<string, CircuitSuggestion>();
  for (const s of suggestions ?? []) suggMap.set(s.circuitId, s);

  const annotated = filtered.map((c) => ({
    circuit: c,
    suggestion: suggMap.get(c.id),
  }));
  const suggested = annotated
    .filter((a) => a.suggestion)
    .sort(
      (a, b) =>
        b.suggestion!.score - a.suggestion!.score ||
        a.circuit.name.localeCompare(b.circuit.name),
    );
  const others = annotated
    .filter((a) => !a.suggestion)
    .sort((a, b) => a.circuit.name.localeCompare(b.circuit.name));
  const showGroups = !q && suggested.length > 0 && others.length > 0;

  if (availableCircuits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Aucun circuit disponible. Basculez sur «&nbsp;Nouveau circuit&nbsp;» pour
        en créer un.
      </div>
    );
  }

  const renderRow = (a: {
    circuit: CircuitListItem;
    suggestion?: CircuitSuggestion;
  }) => (
    <CircuitRow
      key={a.circuit.id}
      circuit={a.circuit}
      suggestion={a.suggestion}
      selected={a.circuit.id === value}
      onSelect={() => onSelect(a.circuit.id)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un circuit…"
          className="pl-9"
        />
      </div>

      {suggestionsLoading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3 animate-pulse text-primary" />
          Analyse des circuits à proximité…
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">
          Aucun circuit ne correspond.
        </p>
      ) : showGroups ? (
        <div
          role="radiogroup"
          aria-label="Circuits disponibles"
          className="space-y-3"
        >
          <div className="overflow-hidden rounded-lg border border-border">
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-4 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Suggestions
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {suggested.length}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                classées par pertinence
              </span>
            </div>
            <div className="max-h-[20rem] divide-y divide-border overflow-y-auto bg-primary/[0.02]">
              {suggested.map(renderRow)}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Autres circuits
                <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {others.length}
                </span>
              </span>
            </div>
            <div className="max-h-[20rem] divide-y divide-border overflow-y-auto">
              {others.map(renderRow)}
            </div>
          </div>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Circuits disponibles"
          className="max-h-[24rem] divide-y divide-border overflow-auto rounded-lg border border-border"
        >
          {suggested.map(renderRow)}
          {others.map(renderRow)}
        </div>
      )}
    </div>
  );
}

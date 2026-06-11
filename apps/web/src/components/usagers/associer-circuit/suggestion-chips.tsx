"use client";

import { Route, School, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { CircuitSuggestionReason } from "./types";

// --- Reason chips ---

const SUGGESTION_REASON_ICONS: Record<string, LucideIcon> = {
  etablissement: School,
  trajet: Route,
  arret: MapPin,
};

const SUGGESTION_REASON_STYLES: Record<string, string> = {
  // Établissement = main signal → solid primary chip (readable in light/dark).
  etablissement: "border-transparent bg-primary text-primary-foreground",
  trajet:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  arret: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

function formatChipDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 10) * 10} m`;
}

interface SuggestionReasonChipProps {
  reason: CircuitSuggestionReason;
}

export function SuggestionReasonChip({ reason }: SuggestionReasonChipProps) {
  const Icon = SUGGESTION_REASON_ICONS[reason.kind] ?? Sparkles;
  return (
    <span
      title={reason.detail}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        SUGGESTION_REASON_STYLES[reason.kind] ??
          "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {reason.label}
      {reason.distanceM != null && reason.kind !== "etablissement" && (
        <span className="font-normal opacity-70">
          · ~{formatChipDistance(reason.distanceM)}
        </span>
      )}
    </span>
  );
}

// --- Relevance tag (relevance tier) ---

function relevanceTier(score: number): { label: string; className: string } {
  if (score >= 80)
    return {
      label: "Idéal",
      className: "border-transparent bg-emerald-600 text-white",
    };
  if (score >= 40)
    return {
      label: "Recommandé",
      className: "border-transparent bg-primary text-primary-foreground",
    };
  return {
    label: "Possible",
    className: "border border-border bg-muted text-muted-foreground",
  };
}

interface RelevanceTagProps {
  score: number;
}

export function RelevanceTag({ score }: RelevanceTagProps) {
  const t = relevanceTier(score);
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        t.className,
      )}
    >
      {t.label}
    </span>
  );
}

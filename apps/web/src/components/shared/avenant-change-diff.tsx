import { ArrowRight, Plus } from "lucide-react";
import { DayBadges } from "./day-badges";
import type { DayEntry } from "@/lib/types/day-entry";

type Snap = Record<string, unknown> | null | undefined;

function asDays(v: unknown): DayEntry[] | number[] | null {
  if (Array.isArray(v)) return v as DayEntry[] | number[];
  return null;
}

function genericLabel(type: string, snap: Snap): string {
  if (!snap) return "";
  if (type === "etablissement") return String(snap.etablissementName ?? "");
  if (type === "type_transport")
    return String(snap.transportTypeLabel ?? snap.transportType ?? "");
  if (type === "circuit") return String(snap.circuitName ?? "");
  if (type === "adresse") {
    return [snap.address, snap.city].filter(Boolean).join(", ");
  }
  return "";
}

/** Displays the "before → after" delta of an avenant change. */
export function AvenantChangeDiff({
  type,
  previous,
  next,
}: {
  type: string;
  previous: Snap;
  next: Snap;
}) {
  // Usager addition: there is no "before" state (the usager was not on the
  // circuit) → display the target, not a delta.
  if (type === "ajout") {
    const circuitName = String(next?.circuitName ?? "");
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-foreground">
          Ajouté au circuit{circuitName ? ` ${circuitName}` : ""}
        </span>
      </div>
    );
  }

  if (type === "jours_pec") {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            Aller
          </span>
          <DayBadges days={asDays(previous?.daysAller)} />
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <DayBadges days={asDays(next?.daysAller)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            Retour
          </span>
          <DayBadges days={asDays(previous?.daysRetour)} />
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <DayBadges days={asDays(next?.daysRetour)} />
        </div>
      </div>
    );
  }

  const before = genericLabel(type, previous);
  const after = genericLabel(type, next);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground line-through decoration-muted-foreground/40">
        {before || "—"}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="font-medium text-foreground">{after || "—"}</span>
    </div>
  );
}

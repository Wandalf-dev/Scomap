// Types and helpers for the resource scheduler (Transcolaire-style planning):
// rows = resources (chauffeurs/véhicules), columns = time.
import type { OccurrenceItem } from "../types";
import { resolvedDepartureTime } from "../types";

export type SchedulerViewMode = "jour" | "semaine" | "mois" | "trimestre";
export type ResourceMode = "chauffeurs" | "vehicules";
export type EventDensity = "expanded" | "condensed";

export const UNASSIGNED_ROW_KEY = "__unassigned__";

export interface SchedulerRow {
  key: string;
  name: string;
  /** Second line shown when the resource column is expanded (phone, plate…). */
  detail: string | null;
  /** Native tooltip with contact info, like the legacy row headers. */
  tooltip: string | null;
  unassigned: boolean;
}

export interface SchedulerFilters {
  circuitId: string | null;
  etablissementId: string | null;
  chauffeurId: string | null;
  vehiculeId: string | null;
  direction: string | null;
  statut: string | null;
}

export const EMPTY_FILTERS: SchedulerFilters = {
  circuitId: null,
  etablissementId: null,
  chauffeurId: null,
  vehiculeId: null,
  direction: null,
  statut: null,
};

export function countActiveFilters(f: SchedulerFilters): number {
  return Object.values(f).filter((v) => v !== null).length;
}

// Legacy TransScolaire palette: solid blocks with white text
// (aller = scheduler default blue, retour = circuit green).
export const EVENT_COLORS = {
  aller: { bg: "#09b2ef", border: "#079beb" },
  retour: { bg: "#4ab200", border: "#3f9a00" },
  annule: { bg: "#dc2626", border: "#b91c1c" },
} as const;

/** Orange band on top of the block = occurrence personnalisée (legacy "bandeau orange"). */
export const CUSTOMIZED_BAND_COLOR = "#ffa500";

export function eventColor(occ: OccurrenceItem): { bg: string; border: string } {
  if (occ.status === "annule") return EVENT_COLORS.annule;
  return occ.trajetDirection === "aller"
    ? EVENT_COLORS.aller
    : EVENT_COLORS.retour;
}

export function resolveResourceId(
  occ: OccurrenceItem,
  mode: ResourceMode,
): string {
  const id =
    mode === "chauffeurs"
      ? occ.overrideChauffeurId ?? occ.trajetChauffeurId
      : occ.overrideVehiculeId ?? occ.trajetVehiculeId;
  return id ?? UNASSIGNED_ROW_KEY;
}

export function chauffeurFullName(occ: OccurrenceItem): string | null {
  if (!occ.chauffeurFirstName && !occ.chauffeurLastName) return null;
  return `${occ.chauffeurFirstName ?? ""} ${occ.chauffeurLastName ?? ""}`.trim();
}

export function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** End time derived from the trajet's computed duration (fallback 30 min). */
export function occurrenceEndTime(occ: OccurrenceItem): string | null {
  const start = timeToMinutes(resolvedDepartureTime(occ));
  if (start === null) return null;
  const durationMin = Math.max(
    5,
    Math.round((occ.trajetDurationSeconds ?? 1800) / 60),
  );
  return minutesToTime(Math.min(start + durationMin, 23 * 60 + 59));
}

/** Native tooltip text, mirroring the legacy event bubble ("de X à Y"). */
export function occurrenceTooltip(occ: OccurrenceItem): string {
  const start = resolvedDepartureTime(occ);
  const end = occurrenceEndTime(occ);
  const lines = [occ.trajetName];
  if (start) lines.push(`de ${start}${end ? ` à ${end}` : ""}`);
  if (occ.circuitName) lines.push(`Circuit : ${occ.circuitName}`);
  const chauffeur = chauffeurFullName(occ);
  if (chauffeur) lines.push(`Chauffeur : ${chauffeur}`);
  if (occ.vehiculeName) lines.push(`Véhicule : ${occ.vehiculeName}`);
  if (occ.overrideNotes) lines.push(`Notes : ${occ.overrideNotes}`);
  return lines.join("\n");
}

/** "Filtre contenu": text match on everything displayed by the event. */
export function occurrenceMatchesText(
  occ: OccurrenceItem,
  filter: string,
): boolean {
  if (!filter) return true;
  const haystack = [
    occ.trajetName,
    occ.circuitName,
    chauffeurFullName(occ),
    occ.vehiculeName,
    resolvedDepartureTime(occ),
    occ.overrideNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return haystack.includes(filter.toUpperCase());
}

/** Payload sent when an event is drag-dropped. */
export interface OccurrenceMoveData {
  chauffeurId?: string;
  vehiculeId?: string;
  departureTime?: string;
}

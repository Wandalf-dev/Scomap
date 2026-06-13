// Shared type for planning occurrences (output of trajets.listOccurrences).
// Occurrences are derived from trajets: `id` only exists if an exception row
// (customization/status) has been created. The functional identity
// is the pair (trajetId, date).
export interface OccurrenceItem {
  id: string | null;
  trajetId: string;
  date: string;
  status: string;
  trajetName: string;
  trajetDirection: string;
  trajetDepartureTime: string | null;
  trajetChauffeurId: string | null;
  trajetVehiculeId: string | null;
  overrideDepartureTime: string | null;
  overrideChauffeurId: string | null;
  overrideVehiculeId: string | null;
  overrideNotes: string | null;
  trajetDurationSeconds: number | null;
  circuitId: string;
  circuitName: string | null;
  etablissementId: string | null;
  chauffeurFirstName: string | null;
  chauffeurLastName: string | null;
  vehiculeName: string | null;
}

/** An occurrence is "customized" as soon as at least one override is set. */
export function hasOverride(occ: OccurrenceItem): boolean {
  return (
    occ.overrideChauffeurId !== null ||
    occ.overrideVehiculeId !== null ||
    occ.overrideDepartureTime !== null ||
    (occ.overrideNotes !== null && occ.overrideNotes !== "")
  );
}

/** Resolved time: one-off override takes priority over the trajet departure time. */
export function resolvedDepartureTime(occ: OccurrenceItem): string | null {
  return occ.overrideDepartureTime ?? occ.trajetDepartureTime;
}

export const STATUS_DOTS: Record<string, string> = {
  planifie: "bg-muted-foreground",
  en_cours: "bg-blue-500",
  termine: "bg-green-500",
  annule: "bg-red-500",
};

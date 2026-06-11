// Type partagé des occurrences du planning (sortie de trajets.listOccurrences).
// Les occurrences sont dérivées des trajets : `id` n'existe que si une ligne
// d'exception (personnalisation/statut) a été créée. L'identité fonctionnelle
// est le couple (trajetId, date).
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
  circuitName: string | null;
  chauffeurFirstName: string | null;
  chauffeurLastName: string | null;
  vehiculeName: string | null;
}

/** Une occurrence est « personnalisée » dès qu'au moins un override est posé. */
export function hasOverride(occ: OccurrenceItem): boolean {
  return (
    occ.overrideChauffeurId !== null ||
    occ.overrideVehiculeId !== null ||
    occ.overrideDepartureTime !== null ||
    (occ.overrideNotes !== null && occ.overrideNotes !== "")
  );
}

/** Heure résolue : override ponctuel prioritaire sur l'heure du trajet. */
export function resolvedDepartureTime(occ: OccurrenceItem): string | null {
  return occ.overrideDepartureTime ?? occ.trajetDepartureTime;
}

export const STATUS_DOTS: Record<string, string> = {
  planifie: "bg-muted-foreground",
  en_cours: "bg-blue-500",
  termine: "bg-green-500",
  annule: "bg-red-500",
};

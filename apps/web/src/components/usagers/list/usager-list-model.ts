import { CLASSES_BY_TYPE } from "@/lib/validators/usager";

export const CLASSE_LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const list of Object.values(CLASSES_BY_TYPE)) {
    for (const c of list) map[c.value] = c.label;
  }
  return map;
})();

// Left accent bar on the row depending on the transport type (carried over from Transcolaire).
export const TRANSPORT_ACCENT: Record<string, string> = {
  taxi_collectif_individuel: "bg-blue-500",
  transport_famille: "bg-orange-500",
  transport_commun: "bg-yellow-400",
};

export interface UsagerRow {
  id: string;
  displayId: number;
  code: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  status: string;
  regime: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
  secondaryEtablissementId: string | null;
  secondaryEtablissementName: string | null;
  classe: string | null;
  transportType: string | null;
  transportStartDate: string | null;
  transportEndDate: string | null;
  transportParticularity: string | null;
  specificity: string | null;
  notes: string | null;
  archivedAt: Date | null;
}

export type UsagerFilters = {
  displayId: string;
  code: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  gender: string;
  status: string;
  regime: string;
  classe: string;
  transportType: string;
  etablissementName: string;
  etablissementCity: string;
  secondaryEtablissementName: string;
  transportStartDate: string;
  transportEndDate: string;
  transportParticularity: string;
  specificity: string;
  notes: string;
};

export const EMPTY_FILTERS: UsagerFilters = {
  displayId: "",
  code: "",
  lastName: "",
  firstName: "",
  birthDate: "",
  gender: "all",
  status: "all",
  regime: "all",
  classe: "all",
  transportType: "all",
  etablissementName: "all",
  etablissementCity: "",
  secondaryEtablissementName: "all",
  transportStartDate: "",
  transportEndDate: "",
  transportParticularity: "",
  specificity: "",
  notes: "",
};

export type SortColumn = "lastName" | "firstName" | "birthDate" | "etablissementName" | "etablissementCity";

export function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  } catch {
    return dateStr;
  }
}

import { z } from "zod";

export const USAGER_STATUSES = [
  "brouillon",
  "en_attente",
  "actif",
  "suspendu",
  "refuse",
  "archive",
] as const;

export const USAGER_STATUS_LABELS: Record<typeof USAGER_STATUSES[number], string> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  actif: "Actif",
  suspendu: "Suspendu",
  refuse: "Refusé",
  archive: "Archivé",
};

export const USAGER_REGIMES = [
  "demi_pensionnaire",
  "interne",
  "externe",
] as const;

export const USAGER_REGIME_LABELS: Record<typeof USAGER_REGIMES[number], string> = {
  demi_pensionnaire: "Demi-pensionnaire",
  interne: "Interne",
  externe: "Externe",
};

export const USAGER_TRANSPORT_TYPES = [
  "taxi_collectif",
  "taxi_individuel",
  "vehicule_adapte",
  "transport_collectif",
  "transport_en_commun",
  "vehicule_personnel",
  "ambulance_vsl",
] as const;

export const USAGER_TRANSPORT_TYPE_LABELS: Record<typeof USAGER_TRANSPORT_TYPES[number], string> = {
  taxi_collectif: "Taxi collectif",
  taxi_individuel: "Taxi individuel",
  vehicule_adapte: "Véhicule adapté (TPMR)",
  transport_collectif: "Bus / Autocar scolaire",
  transport_en_commun: "Transport en commun",
  vehicule_personnel: "Véhicule personnel (famille)",
  ambulance_vsl: "Ambulance / VSL",
};

export const ETABLISSEMENT_TYPES = [
  "ecole",
  "college",
] as const;

export const ETABLISSEMENT_TYPE_LABELS: Record<typeof ETABLISSEMENT_TYPES[number], string> = {
  ecole: "École",
  college: "Collège",
};

export const CLASSES_BY_TYPE: Record<typeof ETABLISSEMENT_TYPES[number], { value: string; label: string }[]> = {
  ecole: [
    { value: "ps", label: "PS" },
    { value: "ms", label: "MS" },
    { value: "gs", label: "GS" },
    { value: "cp", label: "CP" },
    { value: "ce1", label: "CE1" },
    { value: "ce2", label: "CE2" },
    { value: "cm1", label: "CM1" },
    { value: "cm2", label: "CM2" },
  ],
  college: [
    { value: "6eme", label: "6ème" },
    { value: "5eme", label: "5ème" },
    { value: "4eme", label: "4ème" },
    { value: "3eme", label: "3ème" },
  ],
};

/** Types de transport qui nécessitent un circuit géré par l'opérateur */
export const CIRCUIT_TRANSPORT_TYPES: Set<string> = new Set([
  "taxi_collectif",
  "taxi_individuel",
  "vehicule_adapte",
  "transport_collectif",
]);

/** Vérifie si un type de transport est compatible avec un circuit (vrai si compatible ou non défini) */
export function isCircuitCompatibleTransport(transportType: string | null | undefined): boolean {
  if (!transportType) return true; // pas de type défini = on ne bloque pas
  return CIRCUIT_TRANSPORT_TYPES.has(transportType);
}

// Schéma pour la création rapide (dialog de la liste)
export const usagerSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F"]).optional().or(z.literal("")),
  etablissementId: z.string().uuid().optional().or(z.literal("")),
});

export type UsagerFormValues = z.infer<typeof usagerSchema>;

// Schéma complet pour la fiche détail
export const usagerDetailSchema = z.object({
  code: z.string().optional(),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F"]).optional().or(z.literal("")),
  status: z.enum(USAGER_STATUSES).optional(),
  regime: z.enum(USAGER_REGIMES).optional().or(z.literal("")),
  etablissementId: z.string().uuid().optional().or(z.literal("")),
  secondaryEtablissementId: z.string().uuid().optional().or(z.literal("")),
  classe: z.string().optional().or(z.literal("")),
  transportStartDate: z.string().min(1, "Date de début de transport requise"),
  transportEndDate: z.string().nullable().optional(),
  transportParticularity: z.string().optional(),
  specificity: z.string().optional(),
  notes: z.string().optional(),
});

export type UsagerDetailFormValues = z.infer<typeof usagerDetailSchema>;

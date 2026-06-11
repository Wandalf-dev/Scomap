import { z } from "zod";

// Business statuses (from Transcolaire, codes 0→5).
export const USAGER_STATUSES = [
  "non_controle",
  "controle",
  "modifie",
  "en_attente",
  "refuse_annule",
  "a_reconduire",
] as const;

export const USAGER_STATUS_LABELS: Record<typeof USAGER_STATUSES[number], string> = {
  non_controle: "Non contrôlé",
  controle: "Contrôlé",
  modifie: "Modifié",
  en_attente: "En attente",
  refuse_annule: "Refusé / Annulé",
  a_reconduire: "À reconduire",
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

// 3 transport categories (inspired by Transcolaire bd1.D1TYPETRAN).
// - taxi_collectif_individuel : transport operated by the carrier → CIRCUIT
// - transport_famille         : family-driven → mileage reimbursement (coming soon)
// - transport_commun          : bus / train / tram → pass reimbursement (coming soon)
export const USAGER_TRANSPORT_TYPES = [
  "taxi_collectif_individuel",
  "transport_famille",
  "transport_commun",
] as const;

export const USAGER_TRANSPORT_TYPE_LABELS: Record<typeof USAGER_TRANSPORT_TYPES[number], string> = {
  taxi_collectif_individuel: "Taxi collectif / individuel",
  transport_famille: "Transport par la famille",
  transport_commun: "Transport en commun (bus, train, tramway)",
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
  "taxi_collectif_individuel",
]);

/** Vérifie si un type de transport est compatible avec un circuit (vrai si compatible ou non défini) */
export function isCircuitCompatibleTransport(transportType: string | null | undefined): boolean {
  if (!transportType) return true; // pas de type défini = on ne bloque pas
  return CIRCUIT_TRANSPORT_TYPES.has(transportType);
}

/** Types de transport sans circuit, donnant lieu à un remboursement à la famille */
export const REIMBURSEMENT_TRANSPORT_TYPES: Set<string> = new Set([
  "transport_famille",
  "transport_commun",
]);

/** Vérifie si un type de transport relève du remboursement (famille / transport en commun) */
export function isReimbursementTransport(transportType: string | null | undefined): boolean {
  if (!transportType) return false;
  return REIMBURSEMENT_TRANSPORT_TYPES.has(transportType);
}

// Schema for quick creation (list dialog)
export const usagerSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  birthDate: z.string().max(32).optional(),
  gender: z.enum(["M", "F"]).optional().or(z.literal("")),
  etablissementId: z.string().uuid().optional().or(z.literal("")),
});

export type UsagerFormValues = z.infer<typeof usagerSchema>;

// Full schema for the detail page
export const usagerDetailSchema = z.object({
  code: z.string().max(50).optional(),
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  birthDate: z.string().max(32).optional(),
  gender: z.enum(["M", "F"]).optional().or(z.literal("")),
  status: z.enum(USAGER_STATUSES).optional(),
  regime: z.enum(USAGER_REGIMES).optional().or(z.literal("")),
  etablissementId: z.string().uuid().optional().or(z.literal("")),
  secondaryEtablissementId: z.string().uuid().optional().or(z.literal("")),
  classe: z.string().max(20).optional().or(z.literal("")),
  transportType: z.enum(USAGER_TRANSPORT_TYPES).optional().or(z.literal("")),
  distanceKm: z.number().nonnegative().nullable().optional(),
  transportStartDate: z.string().min(1, "Date de début de transport requise").max(32),
  transportEndDate: z.string().max(32).nullable().optional(),
  transportParticularity: z.string().max(5000).optional(),
  specificity: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});

export type UsagerDetailFormValues = z.infer<typeof usagerDetailSchema>;

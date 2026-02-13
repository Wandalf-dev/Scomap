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
  transportStartDate: z.string().nullable().optional(),
  transportEndDate: z.string().nullable().optional(),
  transportParticularity: z.string().optional(),
  specificity: z.string().optional(),
  notes: z.string().optional(),
});

export type UsagerDetailFormValues = z.infer<typeof usagerDetailSchema>;

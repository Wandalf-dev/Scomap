import { z } from "zod";

// Statut de contrôle/validation du circuit (4 codes, façon usager / E1VALID
// de Transcolaire). Distinct de l'archivage (archivedAt).
export const CIRCUIT_STATUSES = [
  "non_controle",
  "controle",
  "modifie",
  "en_attente",
] as const;

export const CIRCUIT_STATUS_LABELS: Record<
  (typeof CIRCUIT_STATUSES)[number],
  string
> = {
  non_controle: "Non contrôlé",
  controle: "Contrôlé",
  modifie: "Modifié",
  en_attente: "En attente",
};

// Schema pour la creation rapide (dialog de la liste)
export const circuitSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  etablissementId: z.string().uuid("Etablissement requis"),
});

export type CircuitFormValues = z.infer<typeof circuitSchema>;

// Schema complet pour la fiche detail
export const circuitDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  code: z.string().max(50, "Code trop long").optional(),
  status: z.enum(CIRCUIT_STATUSES).optional(),
  etablissementId: z.string().uuid("Etablissement requis"),
  description: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export type CircuitDetailFormValues = z.infer<typeof circuitDetailSchema>;

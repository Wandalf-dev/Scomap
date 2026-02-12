import { z } from "zod";

export const directionEnum = z.enum(["aller", "retour"]);
export type Direction = z.infer<typeof directionEnum>;

export const occurrenceStatusEnum = z.enum([
  "planifie",
  "en_cours",
  "termine",
  "annule",
]);
export type OccurrenceStatus = z.infer<typeof occurrenceStatusEnum>;

export const recurrenceRuleSchema = z.object({
  frequency: z.literal("weekly"),
  daysOfWeek: z.array(z.number().min(1).max(7)).min(1, "Selectionnez au moins un jour"),
});

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

// Schema pour la creation rapide (dialog de la liste)
export const trajetSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  circuitId: z.string().uuid("Circuit requis"),
  direction: directionEnum,
});

export type TrajetFormValues = z.infer<typeof trajetSchema>;

// Schema complet pour la fiche detail / creation
export const trajetDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  circuitId: z.string().uuid("Circuit requis"),
  direction: directionEnum,
  chauffeurId: z.string().uuid().nullable().optional(),
  vehiculeId: z.string().uuid().nullable().optional(),
  departureTime: z.string().optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  startDate: z.string().min(1, "Date de debut requise"),
  endDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  etat: z.string().nullable().optional(),
  peages: z.boolean().optional(),
  kmACharge: z.number().min(0).nullable().optional(),
});

export type TrajetDetailFormValues = z.infer<typeof trajetDetailSchema>;

// Schema pour override d'une occurrence (avenant)
export const occurrenceOverrideSchema = z.object({
  chauffeurId: z.string().uuid().nullable().optional(),
  vehiculeId: z.string().uuid().nullable().optional(),
  departureTime: z.string().nullable().optional(),
  status: occurrenceStatusEnum.optional(),
  notes: z.string().nullable().optional(),
});

export type OccurrenceOverrideFormValues = z.infer<typeof occurrenceOverrideSchema>;

// Schema pour un arret (lie a un trajet)
export const arretSchema = z.object({
  type: z.enum(["usager", "etablissement"]),
  usagerAddressId: z.string().uuid().nullable().optional(),
  etablissementId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Nom requis"),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  orderIndex: z.number().min(0),
  arrivalTime: z.string().optional(),
  waitTime: z.number().min(0).optional(),
  distanceKm: z.number().min(0).nullable().optional(),
  durationSeconds: z.number().min(0).nullable().optional(),
  timeLocked: z.boolean().optional(),
}).refine((data) => {
  if (data.type === "usager") return !!data.usagerAddressId;
  if (data.type === "etablissement") return !!data.etablissementId;
  return false;
}, {
  message: "Veuillez selectionner un usager ou un etablissement",
  path: ["name"],
});

export type ArretFormValues = z.infer<typeof arretSchema>;

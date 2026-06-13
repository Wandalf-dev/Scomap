import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";

export const directionEnum = z.enum(["aller", "retour"]);

export const etatEnum = z.enum(["brouillon", "ok", "anomalie", "suspendu"]);
export type Etat = z.infer<typeof etatEnum>;
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
  daysOfWeek: z.array(dayEntrySchema).min(1, "Selectionnez au moins un jour"),
});

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

// Schema for quick creation (list dialog)
export const trajetSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  circuitId: z.string().uuid("Circuit requis"),
  direction: directionEnum,
});

export type TrajetFormValues = z.infer<typeof trajetSchema>;

// Full schema for the detail page / creation
export const trajetDetailSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  circuitId: z.string().uuid("Circuit requis"),
  direction: directionEnum,
  chauffeurId: z.string().uuid().nullable().optional(),
  vehiculeId: z.string().uuid().nullable().optional(),
  departureTime: z.string().max(16).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
  startDate: z.string().max(32).nullable().optional(),
  endDate: z.string().max(32).nullable().optional(),
  notes: z.string().max(5000).optional(),
  peages: z.boolean().optional(),
  kmACharge: z.number().min(0).nullable().optional(),
});

export type TrajetDetailFormValues = z.infer<typeof trajetDetailSchema>;

// Schema for an occurrence override (avenant)
export const occurrenceOverrideSchema = z.object({
  chauffeurId: z.string().uuid().nullable().optional(),
  vehiculeId: z.string().uuid().nullable().optional(),
  departureTime: z.string().max(16).nullable().optional(),
  status: occurrenceStatusEnum.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type OccurrenceOverrideFormValues = z.infer<typeof occurrenceOverrideSchema>;

// Schema for an arrêt (linked to a trajet)
export const arretSchema = z.object({
  type: z.enum(["usager", "etablissement"]),
  usagerAddressId: z.string().uuid().nullable().optional(),
  etablissementId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Nom requis").max(255),
  address: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  orderIndex: z.number().min(0),
  arrivalTime: z.string().max(16).optional(),
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

// One-off stop ADDED to a single occurrence (fiche trajet du jour):
// usager address, établissement, or free geocoded point.
export const occurrenceArretAddSchema = z
  .object({
    type: z.enum(["usager", "etablissement", "libre"]),
    usagerAddressId: z.string().uuid().nullable().optional(),
    etablissementId: z.string().uuid().nullable().optional(),
    name: z.string().min(1, "Nom requis").max(255),
    address: z.string().max(500).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    arrivalTime: z.string().max(16).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "usager") return !!data.usagerAddressId;
      if (data.type === "etablissement") return !!data.etablissementId;
      return true; // libre: name suffices, address optional
    },
    {
      message: "Veuillez sélectionner un usager ou un établissement",
      path: ["name"],
    },
  );

export type OccurrenceArretAddValues = z.infer<typeof occurrenceArretAddSchema>;

import { z } from "zod";

// Schéma pour la création rapide (dialog de la liste)
export const etablissementSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  type: z.string().min(1, "Type requis"),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
});

export type EtablissementFormValues = z.infer<typeof etablissementSchema>;

// Schéma complet pour la fiche détail
export const etablissementDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  type: z.string().min(1, "Type requis"),
  regime: z.string().optional(),
  codeUai: z.string().optional(),
  color: z.string().optional(),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  website: z.string().optional(),
  managerCivility: z.string().optional(),
  managerName: z.string().optional(),
  managerPhone: z.string().optional(),
  managerEmail: z.string().email("Email invalide").or(z.literal("")).optional(),
  observations: z.string().optional(),
});

export type EtablissementDetailFormValues = z.infer<typeof etablissementDetailSchema>;

// Schéma horaires
const dayScheduleSchema = z.object({
  morning: z.string().optional(),
  evening: z.string().optional(),
});

export const schedulesSchema = z.object({
  lundi: dayScheduleSchema,
  mardi: dayScheduleSchema,
  mercredi: dayScheduleSchema,
  jeudi: dayScheduleSchema,
  vendredi: dayScheduleSchema,
  samedi: dayScheduleSchema,
  dimanche: dayScheduleSchema,
});

export type SchedulesFormValues = z.infer<typeof schedulesSchema>;

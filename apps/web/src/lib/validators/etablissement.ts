import { z } from "zod";

// Schema for quick creation (list dialog)
export const etablissementSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  type: z.string().min(1, "Type requis").max(50),
  address: z.string().min(1, "Adresse requise").max(500),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(10).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(254).or(z.literal("")).optional(),
});

export type EtablissementFormValues = z.infer<typeof etablissementSchema>;

// Full schema for the detail page
export const etablissementDetailSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  type: z.string().min(1, "Type requis").max(50),
  regime: z.string().max(50).optional(),
  codeUai: z.string().max(20).optional(),
  color: z.string().max(30).optional(),
  address: z.string().min(1, "Adresse requise").max(500),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(10).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(254).or(z.literal("")).optional(),
  website: z.string().max(500).optional(),
  managerCivility: z.string().max(20).optional(),
  managerName: z.string().max(255).optional(),
  managerPhone: z.string().max(30).optional(),
  managerEmail: z.string().email("Email invalide").max(254).or(z.literal("")).optional(),
  observations: z.string().max(5000).optional(),
});

export type EtablissementDetailFormValues = z.infer<typeof etablissementDetailSchema>;

// Schedules schema
const dayScheduleSchema = z.object({
  morning: z.string().optional(),
  evening: z.string().optional(),
});

// Monday morning is the only mandatory schedule slot.
const lundiScheduleSchema = z.object({
  morning: z.string().min(1, "Horaire du lundi matin requis"),
  evening: z.string().optional(),
});

export const schedulesSchema = z.object({
  lundi: lundiScheduleSchema,
  mardi: dayScheduleSchema,
  mercredi: dayScheduleSchema,
  jeudi: dayScheduleSchema,
  vendredi: dayScheduleSchema,
  samedi: dayScheduleSchema,
  dimanche: dayScheduleSchema,
});

export type SchedulesFormValues = z.infer<typeof schedulesSchema>;

import { z } from "zod";

// Schema pour la creation rapide (dialog de la liste)
export const vehiculeSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  licensePlate: z.string().optional(),
  capacity: z.string().optional(),
});

export type VehiculeFormValues = z.infer<typeof vehiculeSchema>;

// Schema complet pour la fiche detail
export const vehiculeDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  licensePlate: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  capacity: z.string().optional(),
  wheelchairAccessible: z.boolean().optional(),
  notes: z.string().optional(),
});

export type VehiculeDetailFormValues = z.infer<typeof vehiculeDetailSchema>;

// Schema pour l'onglet maintenance
export const vehiculeMaintenanceSchema = z.object({
  insuranceExpiry: z.string().optional(),
  technicalControlExpiry: z.string().optional(),
});

export type VehiculeMaintenanceFormValues = z.infer<typeof vehiculeMaintenanceSchema>;

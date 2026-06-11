import { z } from "zod";

// Schema for quick creation (list dialog)
export const vehiculeSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  licensePlate: z.string().max(20).optional(),
  capacity: z.string().max(10).optional(),
});

export type VehiculeFormValues = z.infer<typeof vehiculeSchema>;

// Full schema for the detail page
export const vehiculeDetailSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  licensePlate: z.string().max(20).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.string().max(10).optional(),
  capacity: z.string().max(10).optional(),
  wheelchairAccessible: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

export type VehiculeDetailFormValues = z.infer<typeof vehiculeDetailSchema>;

// Schema for the maintenance tab
export const vehiculeMaintenanceSchema = z.object({
  insuranceExpiry: z.string().max(32).optional(),
  technicalControlExpiry: z.string().max(32).optional(),
});

export type VehiculeMaintenanceFormValues = z.infer<typeof vehiculeMaintenanceSchema>;

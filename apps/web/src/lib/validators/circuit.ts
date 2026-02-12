import { z } from "zod";

// Schema pour la creation rapide (dialog de la liste)
export const circuitSchema = z.object({
  name: z.string().min(1, "Nom requis"),
});

export type CircuitFormValues = z.infer<typeof circuitSchema>;

// Schema complet pour la fiche detail
export const circuitDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  operatingDays: z.array(z.number().min(1).max(7)).optional(),
});

export type CircuitDetailFormValues = z.infer<typeof circuitDetailSchema>;

// Schema pour un arret
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
});

export type ArretFormValues = z.infer<typeof arretSchema>;

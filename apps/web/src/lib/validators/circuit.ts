import { z } from "zod";

// Schema pour la creation rapide (dialog de la liste)
export const circuitSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  etablissementId: z.string().uuid("Etablissement requis"),
});

export type CircuitFormValues = z.infer<typeof circuitSchema>;

// Schema complet pour la fiche detail
export const circuitDetailSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  etablissementId: z.string().uuid("Etablissement requis"),
  description: z.string().optional(),
  operatingDays: z.array(z.number().min(1).max(7)).optional(),
});

export type CircuitDetailFormValues = z.infer<typeof circuitDetailSchema>;

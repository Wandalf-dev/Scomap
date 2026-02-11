import { z } from "zod";

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
  etablissementId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type UsagerDetailFormValues = z.infer<typeof usagerDetailSchema>;

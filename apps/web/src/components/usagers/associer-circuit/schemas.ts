import { z } from "zod";

// --- Schemas (reused as-is from the old modal) ---

export const linkFormSchema = z.object({
  circuitId: z.string().uuid("Sélectionnez un circuit"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});
export type LinkFormValues = z.infer<typeof linkFormSchema>;

export const createNewFormSchema = z.object({
  circuitName: z.string().min(1, "Nom du circuit requis"),
  etablissementId: z.string().uuid("Sélectionnez un établissement"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});
export type CreateNewFormValues = z.infer<typeof createNewFormSchema>;

export const FORM_ID = "assoc-circuit-form";

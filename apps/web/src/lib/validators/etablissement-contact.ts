import { z } from "zod";

export const etablissementContactSchema = z.object({
  civility: z.string().optional(),
  lastName: z.string().min(1, "Nom requis"),
  firstName: z.string().optional(),
  function: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  observations: z.string().optional(),
});

export type EtablissementContactFormValues = z.infer<typeof etablissementContactSchema>;

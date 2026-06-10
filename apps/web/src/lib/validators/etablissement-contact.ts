import { z } from "zod";

export const etablissementContactSchema = z.object({
  civility: z.string().max(20).optional(),
  lastName: z.string().min(1, "Nom requis").max(100),
  firstName: z.string().max(100).optional(),
  function: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(254).or(z.literal("")).optional(),
  observations: z.string().max(5000).optional(),
});

export type EtablissementContactFormValues = z.infer<typeof etablissementContactSchema>;

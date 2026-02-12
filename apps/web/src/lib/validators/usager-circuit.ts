import { z } from "zod";

export const usagerCircuitSchema = z.object({
  usagerId: z.string().uuid("Usager requis"),
  circuitId: z.string().uuid("Circuit requis"),
  usagerAddressId: z.string().uuid("Adresse requise"),
  daysAller: z.array(z.number().min(1).max(7)).optional(),
  daysRetour: z.array(z.number().min(1).max(7)).optional(),
});

export type UsagerCircuitFormValues = z.infer<typeof usagerCircuitSchema>;

export const usagerCircuitUpdateSchema = z.object({
  usagerAddressId: z.string().uuid().optional(),
  daysAller: z.array(z.number().min(1).max(7)).optional(),
  daysRetour: z.array(z.number().min(1).max(7)).optional(),
});

export type UsagerCircuitUpdateFormValues = z.infer<typeof usagerCircuitUpdateSchema>;

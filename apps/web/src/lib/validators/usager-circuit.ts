import { z } from "zod";

export const usagerCircuitSchema = z.object({
  usagerId: z.string().uuid("Usager requis"),
  circuitId: z.string().uuid("Circuit requis"),
  usagerAddressId: z.string().uuid("Adresse requise"),
});

export type UsagerCircuitFormValues = z.infer<typeof usagerCircuitSchema>;

export const usagerCircuitUpdateSchema = z.object({
  usagerAddressId: z.string().uuid().optional(),
});

export type UsagerCircuitUpdateFormValues = z.infer<typeof usagerCircuitUpdateSchema>;

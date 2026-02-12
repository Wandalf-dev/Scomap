import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";

export const usagerAddressSchema = z.object({
  position: z.number().int().min(1).max(4),
  label: z.string().optional(),
  civility: z.string().optional(),
  responsibleLastName: z.string().optional(),
  responsibleFirstName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  observations: z.string().optional(),
  daysAller: z.array(dayEntrySchema).optional(),
  daysRetour: z.array(dayEntrySchema).optional(),
});

export type UsagerAddressFormValues = z.infer<typeof usagerAddressSchema>;

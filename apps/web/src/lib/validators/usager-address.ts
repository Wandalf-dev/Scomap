import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";

export const ADDRESS_TYPES = [
  "parents",
  "pere",
  "mere",
  "grand_parent",
  "famille_accueil",
  "foyer",
  "etudiant_majeur",
  "autre",
] as const;

export const ADDRESS_TYPE_LABELS: Record<typeof ADDRESS_TYPES[number], string> = {
  parents: "Parents",
  pere: "Père",
  mere: "Mère",
  grand_parent: "Grand-parent",
  famille_accueil: "Famille d'accueil",
  foyer: "Foyer",
  etudiant_majeur: "Étudiant majeur",
  autre: "Autre",
};

export const usagerAddressSchema = z.object({
  position: z.number().int().min(1).max(4),
  type: z.enum(ADDRESS_TYPES).optional().or(z.literal("")),
  civility: z.string().max(20).optional(),
  responsibleLastName: z.string().max(100).optional(),
  responsibleFirstName: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(10).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(30).optional(),
  mobile: z.string().max(30).optional(),
  secondaryPhone: z.string().max(30).optional(),
  secondaryMobile: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(254).or(z.literal("")).optional(),
  authorizedPerson: z.string().max(500).optional(),
  observations: z.string().max(5000).optional(),
  daysAller: z.array(dayEntrySchema).optional(),
  daysRetour: z.array(dayEntrySchema).optional(),
});

export type UsagerAddressFormValues = z.infer<typeof usagerAddressSchema>;

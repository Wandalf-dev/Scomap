import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";
import { USAGER_TRANSPORT_TYPES } from "@/lib/validators/usager";

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
  secondaryPhone: z.string().optional(),
  secondaryMobile: z.string().optional(),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  authorizedPerson: z.string().optional(),
  transportType: z.enum(USAGER_TRANSPORT_TYPES).optional().or(z.literal("")),
  observations: z.string().optional(),
  daysAller: z.array(dayEntrySchema).optional(),
  daysRetour: z.array(dayEntrySchema).optional(),
});

export type UsagerAddressFormValues = z.infer<typeof usagerAddressSchema>;

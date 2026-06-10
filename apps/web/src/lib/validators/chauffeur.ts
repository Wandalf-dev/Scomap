import { z } from "zod";

// Schema pour la creation rapide (dialog de la liste)
export const chauffeurSchema = z.object({
  firstName: z.string().min(1, "Prenom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(254).optional().or(z.literal("")),
});

export type ChauffeurFormValues = z.infer<typeof chauffeurSchema>;

// Schema complet pour la fiche detail
export const chauffeurDetailSchema = z.object({
  firstName: z.string().min(1, "Prenom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide").max(254).optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  hireDate: z.string().max(32).optional(),
  notes: z.string().max(5000).optional(),
});

export type ChauffeurDetailFormValues = z.infer<typeof chauffeurDetailSchema>;

// Schema pour l'onglet documents
export const chauffeurDocumentsSchema = z.object({
  licenseNumber: z.string().max(100).optional(),
  licenseExpiry: z.string().max(32).optional(),
  medicalCertificateExpiry: z.string().max(32).optional(),
});

export type ChauffeurDocumentsFormValues = z.infer<typeof chauffeurDocumentsSchema>;

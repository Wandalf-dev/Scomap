import { z } from "zod";

// Schema pour la creation rapide (dialog de la liste)
export const chauffeurSchema = z.object({
  firstName: z.string().min(1, "Prenom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

export type ChauffeurFormValues = z.infer<typeof chauffeurSchema>;

// Schema complet pour la fiche detail
export const chauffeurDetailSchema = z.object({
  firstName: z.string().min(1, "Prenom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
});

export type ChauffeurDetailFormValues = z.infer<typeof chauffeurDetailSchema>;

// Schema pour l'onglet documents
export const chauffeurDocumentsSchema = z.object({
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  medicalCertificateExpiry: z.string().optional(),
});

export type ChauffeurDocumentsFormValues = z.infer<typeof chauffeurDocumentsSchema>;

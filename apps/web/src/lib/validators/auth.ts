import { z } from "zod";

// Le `.max()` sur le mot de passe borne le travail bcrypt (qui tronque à
// 72 octets de toute façon) ; pas de `.min()` au login pour ne pas bloquer
// d'éventuels comptes antérieurs à la politique actuelle.
export const loginSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  password: z.string().min(1, "Mot de passe requis").max(128),
});

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(100),
  lastName: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide").max(254),
  password: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères")
    .max(128),
});

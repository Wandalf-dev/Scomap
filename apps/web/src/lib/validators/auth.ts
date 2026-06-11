import { z } from "zod";

// The `.max()` on password caps the bcrypt work (which truncates at 72 bytes
// anyway); no `.min()` at login to avoid blocking accounts created before the
// current password policy.
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

import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "user"] as const;

export const USER_ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  user: "Utilisateur",
};

export const userCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(100),
  lastName: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide").max(254),
  role: z.enum(USER_ROLES),
  // Mot de passe provisoire transmis hors-app par l'admin (pas d'infra email)
  password: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères")
    .max(128),
});

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;

export const userProfileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(200),
});

export type UserProfileUpdateFormValues = z.infer<typeof userProfileUpdateSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis").max(128),
  newPassword: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères")
    .max(128),
});

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

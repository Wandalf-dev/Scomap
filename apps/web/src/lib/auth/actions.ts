"use server";

import { headers } from "next/headers";
import { hash } from "bcryptjs";
import { db } from "@scomap/db";
import { users, tenants } from "@scomap/db/schema";
import { eq, and } from "drizzle-orm";
import { signIn } from ".";
import { getTenantSlug } from "../tenant";
import { loginSchema, signupSchema } from "../validators/auth";
import { isRateLimited, recordFailure, clearFailures } from "./rate-limit";
import { AuthError } from "next-auth";

export type AuthState = {
  error?: string;
} | null;

const RATE_LIMIT_ERROR =
  "Trop de tentatives. Réessayez dans quelques minutes.";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// L'inscription publique donne accès à toutes les données du tenant (dont des
// données personnelles de mineurs) : désactivée par défaut, opt-in explicite
// via ENABLE_PUBLIC_SIGNUP=true (dev/onboarding uniquement).
export async function isSignupEnabled(): Promise<boolean> {
  return process.env.ENABLE_PUBLIC_SIGNUP === "true";
}

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  }
  const { email, password } = parsed.data;

  // Anti brute-force : par couple IP+email (ciblé) et par IP seule (énumération)
  const ip = await clientIp();
  const accountKey = `login:${ip}:${email.toLowerCase()}`;
  const ipKey = `login:${ip}`;
  if (isRateLimited(accountKey, 5) || isRateLimited(ipKey, 20)) {
    return { error: RATE_LIMIT_ERROR };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      recordFailure(accountKey);
      recordFailure(ipKey);
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email ou mot de passe incorrect" };
        default:
          return { error: "Une erreur est survenue" };
      }
    }
    // Succès = signIn throw un redirect (pas une AuthError) : on remet les
    // compteurs à zéro avant de laisser la redirection se faire.
    clearFailures(accountKey);
    throw error;
  }

  return null;
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Garde serveur — le masquage du formulaire côté UI n'est pas une protection
  if (!(await isSignupEnabled())) {
    return { error: "Les inscriptions sont désactivées. Contactez votre administrateur." };
  }

  const parsed = signupSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  }
  const { firstName, lastName, email, password } = parsed.data;

  const ip = await clientIp();
  const signupKey = `signup:${ip}`;
  if (isRateLimited(signupKey, 5)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const tenantSlug = await getTenantSlug();

  if (!tenantSlug) {
    return { error: "Accédez via le sous-domaine de votre organisation" };
  }

  // Message générique commun (anti-énumération) : ne pas révéler si c'est le
  // tenant qui n'existe pas ou l'email qui est déjà enregistré.
  const genericError = {
    error: "Impossible de créer le compte avec ces informations.",
  };

  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (tenant.length === 0) {
    recordFailure(signupKey);
    return genericError;
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.tenantId, tenant[0].id)))
    .limit(1);

  if (existingUser.length > 0) {
    recordFailure(signupKey);
    return genericError;
  }

  const passwordHash = await hash(password, 12);

  await db.insert(users).values({
    tenantId: tenant[0].id,
    email,
    name: `${firstName} ${lastName}`,
    passwordHash,
    role: "user",
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Compte créé mais erreur de connexion" };
    }
    throw error;
  }

  return null;
}

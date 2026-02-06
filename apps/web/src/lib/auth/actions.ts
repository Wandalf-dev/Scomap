"use server";

import { hash } from "bcryptjs";
import { db } from "@scomap/db";
import { users, tenants } from "@scomap/db/schema";
import { eq, and } from "drizzle-orm";
import { signIn } from ".";
import { getTenantSlug } from "../tenant";
import { AuthError } from "next-auth";

export type AuthState = {
  error?: string;
} | null;

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email et mot de passe requis" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email ou mot de passe incorrect" };
        default:
          return { error: "Une erreur est survenue" };
      }
    }
    throw error;
  }

  return null;
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!firstName || !lastName || !email || !password) {
    return { error: "Tous les champs sont requis" };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères" };
  }

  const tenantSlug = await getTenantSlug();

  if (!tenantSlug) {
    return { error: "Accédez via le sous-domaine de votre organisation" };
  }

  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (tenant.length === 0) {
    return { error: "Organisation non trouvée" };
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.tenantId, tenant[0].id)))
    .limit(1);

  if (existingUser.length > 0) {
    return { error: "Un compte existe déjà avec cet email" };
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

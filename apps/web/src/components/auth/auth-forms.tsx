"use client";

import { useState, useActionState } from "react";
import { login, signup } from "@/lib/auth/actions";
import { SubmitButton } from "./submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/lib/auth/actions";

export function AuthForms() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction] = useActionState<AuthState, FormData>(login, null);
  const [signupState, signupAction] = useActionState<AuthState, FormData>(signup, null);

  return (
    <div className="space-y-8">
      {mode === "login" ? (
        <div key="login" className="animate-fade-in space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Connexion</h1>
            <p className="text-base text-muted-foreground">
              Entrez vos identifiants pour accéder à votre compte
            </p>
          </div>

          <form action={loginAction} className="space-y-5">
            {loginState?.error && (
              <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loginState.error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                placeholder="nom@exemple.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="login-password">Mot de passe</Label>
                <button
                  type="button"
                  className="ml-auto cursor-pointer text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="login-password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <SubmitButton>Se connecter</SubmitButton>
          </form>

          <div className="text-center text-base">
            <span className="text-muted-foreground">Pas encore de compte ? </span>
            <button
              onClick={() => setMode("signup")}
              className="cursor-pointer text-primary hover:underline"
            >
              Créer un compte
            </button>
          </div>
        </div>
      ) : (
        <div key="signup" className="animate-fade-in space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Créer un compte</h1>
            <p className="text-base text-muted-foreground">
              Renseignez vos informations pour commencer
            </p>
          </div>

          <form action={signupAction} className="space-y-5">
            {signupState?.error && (
              <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {signupState.error}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="signup-firstName">Prénom</Label>
                <Input
                  id="signup-firstName"
                  name="firstName"
                  type="text"
                  placeholder="Jean"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="signup-lastName">Nom</Label>
                <Input
                  id="signup-lastName"
                  name="lastName"
                  type="text"
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                placeholder="nom@exemple.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-password">Mot de passe</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={8}
                required
              />
              <p className="text-sm text-muted-foreground">Minimum 8 caractères</p>
            </div>

            <SubmitButton>Créer mon compte</SubmitButton>
          </form>

          <div className="text-center text-base">
            <span className="text-muted-foreground">Déjà un compte ? </span>
            <button
              onClick={() => setMode("login")}
              className="cursor-pointer text-primary hover:underline"
            >
              Se connecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

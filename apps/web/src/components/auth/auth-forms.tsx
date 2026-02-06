"use client";

import { useState, useActionState } from "react";
import { login, signup } from "@/lib/auth/actions";
import { SubmitButton } from "./submit-button";
import type { AuthState } from "@/lib/auth/actions";

const inputClass =
  "flex h-11 w-full rounded-[0.3rem] border border-input bg-background px-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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

            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="Email"
              required
              className={inputClass}
            />

            <div className="space-y-2">
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Mot de passe"
                required
                className={inputClass}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="cursor-pointer text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
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
              <input
                id="signup-firstName"
                name="firstName"
                type="text"
                placeholder="Prénom"
                required
                className={inputClass}
              />
              <input
                id="signup-lastName"
                name="lastName"
                type="text"
                placeholder="Nom"
                required
                className={inputClass}
              />
            </div>

            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="Email"
              required
              className={inputClass}
            />

            <div className="space-y-2">
              <input
                id="signup-password"
                name="password"
                type="password"
                placeholder="Mot de passe"
                minLength={8}
                required
                className={inputClass}
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

"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

/**
 * Champ mot de passe avec bouton œil pour afficher/masquer la saisie. Composition
 * autour de `Input` (ui shadcn non modifié). Le bouton est `type="button"` pour
 * ne pas soumettre le formulaire ; padding droit (`pr-9`) pour ne pas masquer le texte.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={
          visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

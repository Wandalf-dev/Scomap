"use client";

import NextLink from "next/link";
import { Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldLockProps {
  /** Lien de résolution — typiquement la création d'un avenant. */
  href: string;
  /** Texte affiché dans le tooltip. */
  message?: string;
  className?: string;
}

/**
 * Petit cadenas affiché près du label d'un champ verrouillé (usager affecté à
 * un circuit). Le champ ne se modifie que via un avenant : cliquer le cadenas
 * ouvre la création de l'avenant. Remplace la phrase répétée sous chaque champ.
 */
export function FieldLock({
  href,
  message = "Verrouillé — affecté à un circuit. Modifiable via un avenant.",
  className,
}: FieldLockProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <NextLink
            href={href}
            aria-label={message}
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground/70 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50",
              className,
            )}
          >
            <Lock className="size-3" />
          </NextLink>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

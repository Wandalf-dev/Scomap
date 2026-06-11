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
  /** Resolution link — typically the avenant creation form. */
  href: string;
  /** Text displayed in the tooltip. */
  message?: string;
  className?: string;
}

/**
 * Small padlock displayed near the label of a locked field (usager assigned to
 * a circuit). The field can only be changed via an avenant: clicking the padlock
 * opens the avenant creation form. Replaces the repeated sentence under each field.
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

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarDays, GraduationCap } from "lucide-react";

/**
 * Full-width, highly visible banner signaling preparation mode (≠ prod).
 * `fullBleed` stretches the banner edge-to-edge (compensates for page padding),
 * useful above a detail fiche.
 */
export function PrepaBanner({
  label,
  fullBleed = false,
  note = "les modifications n'affectent pas l'année en cours",
}: {
  label?: string;
  fullBleed?: boolean;
  note?: string;
}) {
  return (
    <div
      className={
        "flex flex-wrap items-center gap-2 border-y-2 border-primary/40 bg-primary/10 px-4 py-3 lg:px-6 " +
        (fullBleed ? "-mx-4 mb-4 lg:-mx-6" : "rounded-lg border")
      }
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <GraduationCap className="size-5 shrink-0" />
        Mode préparation de rentrée
        {label ? ` — ${label}` : ""}
        <span className="hidden font-normal text-primary/80 sm:inline">
          · {note}
        </span>
      </span>
    </div>
  );
}

export function NoCampaign() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 py-16 text-center">
      <CalendarDays className="size-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">Aucune préparation en cours</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Démarrez une préparation depuis le tableau de bord pour copier des
        circuits et des usagers.
      </p>
      <Button asChild className="mt-4 cursor-pointer">
        <Link href="/preparation">Aller au tableau de bord</Link>
      </Button>
    </div>
  );
}

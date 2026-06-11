"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Une erreur est survenue
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Le chargement de cette page a échoué. Vous pouvez réessayer, ou
          revenir au tableau de bord si le problème persiste.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} className="cursor-pointer">
          Réessayer
        </Button>
        <Button asChild variant="outline" className="cursor-pointer">
          <a href="/dashboard">Tableau de bord</a>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Global 404: unmatched URLs (e.g. stale links) land here,
// outside the dashboard chrome since it is rendered in the root layout.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <MapPinOff className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Page introuvable
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          La page demandée n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Button asChild className="cursor-pointer">
        <Link href="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}

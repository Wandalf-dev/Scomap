"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const PointMap = dynamic(
  () => import("@/components/shared/point-map").then((m) => m.PointMap),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);

interface AddressMapDialogProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  /** Titre du dialog + libellé du marqueur. */
  label: string;
  /** Texte affiché à côté de l'icône (sinon bouton icône seule). */
  buttonLabel?: string;
  variant?: "outline" | "ghost" | "secondary";
  triggerClassName?: string;
}

/**
 * Bouton de géolocalisation : ouvre une carte centrée sur la lat/lng fournie
 * (point unique), pour vérifier qu'une adresse saisie pointe au bon endroit.
 * Réutilise TrajetMap (un seul arrêt). Désactivé sans coordonnées.
 */
export function AddressMapDialog({
  latitude,
  longitude,
  label,
  buttonLabel,
  variant = "outline",
  triggerClassName,
}: AddressMapDialogProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const { data: basemap } = useQuery({
    ...trpc.basemap.getStyle.queryOptions(),
    enabled: open && hasCoords,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={buttonLabel ? "sm" : "icon"}
          disabled={!hasCoords}
          aria-label="Voir l'adresse sur la carte"
          title={hasCoords ? "Voir sur la carte" : "Adresse non géolocalisée"}
          className={cn(
            "cursor-pointer gap-1.5 disabled:cursor-not-allowed",
            triggerClassName,
          )}
        >
          <MapPin className="size-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {hasCoords && (
          <PointMap
            latitude={latitude as number}
            longitude={longitude as number}
            label={label}
            basemap={basemap}
            className="h-[420px] w-full"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

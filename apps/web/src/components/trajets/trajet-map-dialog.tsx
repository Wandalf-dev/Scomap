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
import { Map as MapIcon } from "lucide-react";

const TrajetMap = dynamic(
  () => import("./trajet-map").then((mod) => mod.TrajetMap),
  { ssr: false, loading: () => <Skeleton className="h-[460px] w-full" /> },
);

interface TrajetMapDialogProps {
  trajetId: string;
  trajetName: string;
}

/**
 * Preview of a trajet's route in a dialog, without navigating to the fiche.
 * Data (arrêts, geometry, basemap) is loaded on open.
 */
export function TrajetMapDialog({ trajetId, trajetName }: TrajetMapDialogProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: trajet, isLoading: trajetLoading } = useQuery({
    ...trpc.trajets.getById.queryOptions({ id: trajetId }),
    enabled: open,
  });
  const { data: arretsList, isLoading: arretsLoading } = useQuery({
    ...trpc.arrets.list.queryOptions({ trajetId }),
    enabled: open,
  });
  const { data: basemap, isLoading: basemapLoading } = useQuery({
    ...trpc.basemap.getStyle.queryOptions(),
    enabled: open,
  });

  // Until data has arrived, show a skeleton rather than passing arrets=[]
  // to the map (which would show a misleading "no arrêt" message).
  const isLoading = trajetLoading || arretsLoading || basemapLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Voir le tracé sur la carte"
          className="size-8 cursor-pointer text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <MapIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{trajetName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-[460px] w-full" />
        ) : (
          <TrajetMap
            arrets={
              arretsList?.map((a) => ({
                id: a.id,
                name: a.name,
                latitude: a.latitude,
                longitude: a.longitude,
                orderIndex: a.orderIndex,
                type: a.type,
              })) ?? []
            }
            routeGeometry={trajet?.routeGeometry ?? undefined}
            basemap={basemap}
            className="h-[460px] w-full"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

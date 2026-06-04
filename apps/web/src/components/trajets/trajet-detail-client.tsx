"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import {
  ArrowLeft,
  Trash2,
  Route,
  Clock,
  ChevronDown,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TabInformations } from "./tab-informations";
import { TrajetArrets } from "./tab-arrets";
import { TabOccurrences } from "./tab-occurrences";
import type { DayEntry } from "@/lib/types/day-entry";
const TrajetMap = dynamic(
  () => import("./trajet-map").then((mod) => mod.TrajetMap),
  { ssr: false, loading: () => <div className="h-[500px] rounded-[0.3rem] border border-border bg-muted/30 animate-pulse" /> },
);

interface TrajetDetailClientProps {
  id: string;
}

export function TrajetDetailClient({ id }: TrajetDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [occOpen, setOccOpen] = useState(false);

  const { data: trajet, isLoading } = useQuery(
    trpc.trajets.getById.queryOptions({ id }),
  );

  const { data: arretsList } = useQuery(
    trpc.arrets.list.queryOptions({ trajetId: id }),
  );

  const deleteMutation = useMutation(
    trpc.trajets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet supprime");
        router.push("/trajets");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const calculateRouteMutation = useMutation(
    trpc.trajets.calculateRoute.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId: id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.getById.queryKey({ id }),
        });
        const km = data.totalDistanceKm.toFixed(3);
        const min = (data.totalDurationSeconds / 60).toFixed(1);
        toast.success(`Trajet calcule : ${km} km, ${min} min`);
      },
      onError: (err) => {
        toast.error(err.message || "Erreur lors du calcul de trajet");
      },
    }),
  );

  const calculateTimesMutation = useMutation(
    trpc.trajets.calculateTimes.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId: id }),
        });
        toast.success(`Horaires calcules pour ${data.updated} arrets`);
      },
      onError: (err) => {
        toast.error(err.message || "Erreur lors du calcul horaire");
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!trajet) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/trajets")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-muted-foreground/25 p-12 text-center">
          <p className="text-muted-foreground">Trajet non trouve.</p>
        </div>
      </div>
    );
  }

  const totalKm = trajet.totalDistanceKm;
  const totalSeconds = trajet.totalDurationSeconds;

  const directionClass =
    trajet.direction === "aller"
      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
      : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-400";

  const etatLabel =
    trajet.effectiveEtat === "ok"
      ? "Ok"
      : trajet.effectiveEtat === "anomalie"
        ? "Anomalie"
        : trajet.effectiveEtat === "brouillon"
          ? "Brouillon"
          : "Suspendu";

  const etatClass =
    trajet.effectiveEtat === "ok"
      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400"
      : trajet.effectiveEtat === "anomalie"
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
        : trajet.effectiveEtat === "brouillon"
          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
          : "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        {/* Utility row: back + delete */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/trajets")}
            className="-ml-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le trajet</AlertDialogTitle>
                <AlertDialogDescription>
                  Etes-vous sur de vouloir supprimer{" "}
                  <strong>{trajet.name}</strong> ? Cette action est irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={deleteMutation.isPending}
                  className="cursor-pointer"
                >
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate({ id: trajet.id })}
                  disabled={deleteMutation.isPending}
                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Title + badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {trajet.name}
            </h1>
            <Badge variant="outline" className={directionClass}>
              {trajet.direction === "aller" ? "Aller" : "Retour"}
            </Badge>
            <Badge variant="outline" className={`gap-1.5 ${etatClass}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {etatLabel}
            </Badge>
          </div>

          {/* Meta line: circuit + dates */}
          {(trajet.circuitName ||
            trajet.effectiveStartDate ||
            trajet.effectiveEndDate) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {trajet.circuitName && (
                <span className="flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="text-foreground/80">
                    {trajet.circuitName}
                    {trajet.etablissementName &&
                      ` — ${trajet.etablissementName}`}
                  </span>
                </span>
              )}
              {(trajet.effectiveStartDate || trajet.effectiveEndDate) && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="tabular-nums">
                    {trajet.effectiveStartDate ?? "…"} →{" "}
                    {trajet.effectiveEndDate ?? "…"}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form - Informations compactes */}
      <TabInformations
        trajet={{
          id: trajet.id,
          name: trajet.name,
          direction: trajet.direction,
          departureTime: trajet.departureTime,
          recurrence: trajet.recurrence as {
            frequency: string;
            daysOfWeek: DayEntry[];
          } | null,
          startDate: trajet.startDate,
          endDate: trajet.endDate,
          notes: trajet.notes,
          circuitId: trajet.circuitId,
          chauffeurId: trajet.chauffeurId,
          vehiculeId: trajet.vehiculeId,
          peages: trajet.peages,
          kmACharge: trajet.kmACharge,
        }}
        circuitStartDate={trajet.circuitStartDate ?? null}
        circuitEndDate={trajet.circuitEndDate ?? null}
      />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => calculateRouteMutation.mutate({ trajetId: id })}
          disabled={calculateRouteMutation.isPending}
          variant="default"
          className="cursor-pointer"
        >
          {calculateRouteMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Route className="mr-2 h-4 w-4" />
          )}
          Calcul Trajet
        </Button>
        <Button
          onClick={() =>
            calculateTimesMutation.mutate({ trajetId: id, waitTimeSeconds: 0 })
          }
          disabled={calculateTimesMutation.isPending}
          variant="secondary"
          className="cursor-pointer"
        >
          {calculateTimesMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clock className="mr-2 h-4 w-4" />
          )}
          Calcul Horaire
        </Button>

        {totalKm != null && totalSeconds != null && (
          <div className="ml-auto rounded-[0.3rem] bg-primary/10 px-4 py-2 text-sm font-medium text-primary border border-primary/20">
            Distance : {totalKm.toFixed(3)} km — Duree :{" "}
            {(totalSeconds / 60).toFixed(1)} min
          </div>
        )}
      </div>

      {/* Arrets table + Map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TrajetArrets trajetId={id} />
        </div>
        <div className="lg:col-span-2">
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
            routeGeometry={trajet.routeGeometry ?? undefined}
            className="h-[500px]"
          />
        </div>
      </div>

      {/* Occurrences - collapsible */}
      <Collapsible open={occOpen} onOpenChange={setOccOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between cursor-pointer border border-border rounded-[0.3rem] px-4 py-3"
          >
            <span className="font-medium">Occurrences</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${occOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <TabOccurrences trajetId={id} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

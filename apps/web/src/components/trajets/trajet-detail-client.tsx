"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Route,
  Clock,
  ChevronDown,
  Loader2,
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
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Trajet non trouve.</p>
        </div>
      </div>
    );
  }

  const totalKm = trajet.totalDistanceKm;
  const totalSeconds = trajet.totalDurationSeconds;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/trajets")}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {trajet.name}
          </h1>
          <Badge
            variant="outline"
            className={
              trajet.direction === "aller"
                ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                : "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
            }
          >
            {trajet.direction === "aller" ? "Aller" : "Retour"}
          </Badge>
          {trajet.circuitName && (
            <span className="text-sm text-muted-foreground">
              {trajet.circuitName}
              {trajet.etablissementName && ` — ${trajet.etablissementName}`}
            </span>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-destructive hover:text-destructive"
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

      {/* Form - Informations compactes */}
      <TabInformations
        trajet={{
          id: trajet.id,
          name: trajet.name,
          direction: trajet.direction,
          departureTime: trajet.departureTime,
          recurrence: trajet.recurrence as {
            frequency: string;
            daysOfWeek: number[];
          } | null,
          startDate: trajet.startDate,
          endDate: trajet.endDate,
          notes: trajet.notes,
          circuitId: trajet.circuitId,
          chauffeurId: trajet.chauffeurId,
          vehiculeId: trajet.vehiculeId,
          etat: trajet.etat,
          peages: trajet.peages,
          kmACharge: trajet.kmACharge,
        }}
      />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => calculateRouteMutation.mutate({ trajetId: id })}
          disabled={calculateRouteMutation.isPending}
          className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
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
          className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white"
        >
          {calculateTimesMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clock className="mr-2 h-4 w-4" />
          )}
          Calcul Horaire
        </Button>

        {totalKm != null && totalSeconds != null && (
          <div className="ml-auto rounded-[0.3rem] bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
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

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { Route, Clock, Loader2, CalendarDays, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrajetEtatBadge } from "@/components/shared/trajet-etat-badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EntityDetailLayout } from "@/components/shared/entity-detail-layout";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
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
  backHref?: string;
}

export function TrajetDetailClient({ id, backHref }: TrajetDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [occOpen, setOccOpen] = useState(false);

  // Retour contextuel (param ?back=) restreint à un chemin interne (anti open-redirect).
  const safeBack =
    backHref && backHref.startsWith("/") && !backHref.startsWith("//")
      ? backHref
      : "/trajets";

  const { data: trajet, isLoading } = useQuery(
    trpc.trajets.getById.queryOptions({ id }),
  );

  const { data: arretsList } = useQuery(
    // Composition complète du trajet (y compris arrêts à venir d'un avenant).
    trpc.arrets.list.queryOptions({ trajetId: id, all: true }),
  );

  // Fond de carte configuré par le tenant (réglages > Paramètres).
  const { data: basemap } = useQuery(trpc.basemap.getStyle.queryOptions());

  const deleteMutation = useMutation(
    trpc.trajets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.list.queryKey(),
        });
        toast.success("Trajet supprimé");
        router.push(safeBack);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
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
        toast.success(`Trajet calculé : ${km} km, ${min} min`);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors du calcul de trajet");
      },
    }),
  );

  const calculateTimesMutation = useMutation(
    trpc.trajets.calculateTimes.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId: id }),
        });
        toast.success(`Horaires calculés pour ${data.updated} arrêts`);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors du calcul horaire");
      },
    }),
  );

  const totalKm = trajet?.totalDistanceKm;
  const totalSeconds = trajet?.totalDurationSeconds;

  const directionClass =
    trajet?.direction === "aller"
      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
      : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-400";

  // État explicite (km + horaires). hasTimes : tous les arrêts actifs ont une heure.
  const hasTimes =
    !!arretsList &&
    arretsList.length > 0 &&
    arretsList.every((a) => !!a.arrivalTime);

  return (
    <EntityDetailLayout
      isLoading={isLoading}
      entity={trajet}
      backHref={safeBack}
      entityName="Trajet"
      title={trajet?.name ?? ""}
      badges={
        trajet && (
          <span className="flex items-center gap-2">
            <Badge variant="outline" className={directionClass}>
              {trajet.direction === "aller" ? "Aller" : "Retour"}
            </Badge>
            <TrajetEtatBadge
              etat={trajet.effectiveEtat}
              hasKm={trajet.totalDistanceKm != null}
              hasTimes={hasTimes}
            />
          </span>
        )
      }
      onDelete={() => trajet && deleteMutation.mutate({ id: trajet.id })}
      isDeleting={deleteMutation.isPending}
      deleteEntityName="le trajet"
      deleteLabel={trajet?.name ?? ""}
      // Fiche mono-vue : tout reste visible d'un coup (formulaire, arrêts,
      // carte, occurrences), la barre d'onglets est masquée par le layout.
      tabs={[
        {
          value: "fiche",
          label: "Fiche",
          content: trajet ? (
            <div className="space-y-6">
              {/* Rattachement + période effective (avenants compris) */}
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

              {/* Barre d'actions de calcul */}
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
                    calculateTimesMutation.mutate({
                      trajetId: id,
                      waitTimeSeconds: 0,
                    })
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
                    Distance : {totalKm.toFixed(3)} km — Durée :{" "}
                    {(totalSeconds / 60).toFixed(1)} min
                  </div>
                )}
              </div>

              {/* Table des arrêts + carte */}
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
                    basemap={basemap}
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
          ) : null,
        },
      ]}
    />
  );
}

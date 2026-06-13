"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { Route, Clock, Loader2, ChevronDown } from "lucide-react";
import { DirectionBadge } from "@/components/shared/direction-badge";
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

  // Contextual back link (?back= param) restricted to an internal path (anti open-redirect).
  const safeBack =
    backHref && backHref.startsWith("/") && !backHref.startsWith("//")
      ? backHref
      : "/trajets";

  const { data: trajet, isLoading } = useQuery(
    trpc.trajets.getById.queryOptions({ id }),
  );

  const { data: arretsList } = useQuery(
    // Full composition of the trajet (including upcoming arrêts from an avenant).
    trpc.arrets.list.queryOptions({ trajetId: id, all: true }),
  );

  // Basemap configured by the tenant (settings > Paramètres).
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

  // Explicit état (km + horaires). hasTimes: all active arrêts have a time.
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
            <DirectionBadge direction={trajet.direction} />
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
      // Single-view fiche: everything stays visible at once (form, arrêts,
      // map, occurrences); the tab bar is hidden by the layout.
      tabs={[
        {
          value: "fiche",
          label: "Fiche",
          content: trajet ? (
            <div className="space-y-6">
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
                circuitName={trajet.circuitName ?? null}
                etablissementName={trajet.etablissementName ?? null}
                circuitStartDate={trajet.circuitStartDate ?? null}
                circuitEndDate={trajet.circuitEndDate ?? null}
              />

              {/* Calculation action bar */}
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

              {/* Arrêts table + map */}
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

              {/* Occurrences — collapsible */}
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
                  <TabOccurrences
                    trajetId={id}
                    windowStart={trajet.effectiveStartDate ?? null}
                    windowEnd={trajet.effectiveEndDate ?? null}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : null,
        },
      ]}
    />
  );
}

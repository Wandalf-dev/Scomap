"use client";

import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  ExternalLink,
  Users,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DayBadges } from "@/components/shared/day-badges";
import {
  formatCircuitPeriode,
  formatKm,
  formatDuration,
  orderRouteWaypoints,
} from "./helpers";
import { SuggestionReasonChip } from "./suggestion-chips";
import type { LucideIcon } from "lucide-react";
import type { PreviewPoint } from "../circuit-preview-map";
import type {
  CircuitSuggestion,
  PreviewCircuit,
  EtablissementPoint,
  SelectedAddressPoint,
} from "./types";

// --- Map preview (dynamic, ssr:false) ---

const CircuitPreviewMap = dynamic(
  () => import("../circuit-preview-map").then((mod) => mod.CircuitPreviewMap),
  {
    ssr: false,
    loading: () => <div className="h-[200px] w-full animate-pulse bg-muted/40" />,
  },
);

// --- Preview panel (right column) ---

function PreviewStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-1 py-2 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <span className="mt-1 text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

interface CircuitPreviewPanelProps {
  circuit: PreviewCircuit | null;
  suggestion?: CircuitSuggestion;
  isNew: boolean;
  usagerId: string;
  etablissementPoint: EtablissementPoint | null;
  selectedAddressPoint: SelectedAddressPoint | null;
}

export function CircuitPreviewPanel({
  circuit,
  suggestion,
  isNew,
  usagerId,
  etablissementPoint,
  selectedAddressPoint,
}: CircuitPreviewPanelProps) {
  const trpc = useTRPC();
  const circuitId = circuit?.id ?? null;
  const enabled = !isNew && !!circuitId;

  // Circuit validity dates (transport start / end) for the preview.
  const { data: circuitInfo } = useQuery({
    ...trpc.circuits.getById.queryOptions({ id: circuitId ?? "" }),
    enabled,
  });

  // Preview = reflection of the circuit's current state (trajets/arrêts change
  // as soon as a usager is associated). We force a refetch on mount: otherwise
  // the global staleTime (30s) serves a stale cache on client navigation →
  // empty panel until the page is reloaded.
  const { data: circuitTrajets } = useQuery({
    ...trpc.trajets.listByCircuit.queryOptions({ circuitId: circuitId ?? "" }),
    enabled,
    refetchOnMount: "always",
  });
  const trajet = circuitTrajets?.[0] ?? null;
  const trajetId = trajet?.id ?? null;

  const { data: arretsList } = useQuery({
    ...trpc.arrets.list.queryOptions({ trajetId: trajetId ?? "" }),
    enabled: enabled && !!trajetId,
    refetchOnMount: "always",
  });
  // Basemap: always loaded (the points preview is also shown for a new
  // circuit, without a computed trajet).
  const { data: basemap } = useQuery(trpc.basemap.getStyle.queryOptions());

  // Usagers already on the circuit (open versions) → geolocated preview points.
  const { data: circuitUsagers } = useQuery({
    ...trpc.usagerCircuits.listByCircuit.queryOptions({
      circuitId: circuitId ?? "",
      openOnly: true,
    }),
    enabled,
    refetchOnMount: "always",
  });

  const days = trajet?.recurrence?.daysOfWeek ?? [];

  // Real-time preview points: destination établissement + usagers already on
  // the circuit (excluding the current usager) + the current usager's chosen
  // address.
  const previewPoints: PreviewPoint[] = [
    ...(etablissementPoint
      ? [
          {
            id: "etab",
            kind: "etablissement" as const,
            label: `Établissement — ${etablissementPoint.name}`,
            latitude: etablissementPoint.latitude,
            longitude: etablissementPoint.longitude,
          },
        ]
      : []),
    ...(circuitUsagers ?? [])
      .filter((u) => u.usagerId !== usagerId)
      .filter((u) => u.addressLatitude != null && u.addressLongitude != null)
      .map((u) => {
        const addr = [u.addressAddress, u.addressCity]
          .filter(Boolean)
          .join(", ");
        return {
          id: u.id,
          kind: "usager" as const,
          label: `${u.usagerFirstName} ${u.usagerLastName}${addr ? ` — ${addr}` : ""}`,
          latitude: u.addressLatitude,
          longitude: u.addressLongitude,
        };
      }),
    ...(selectedAddressPoint
      ? [
          {
            id: "selected",
            kind: "selected" as const,
            label: selectedAddressPoint.label,
            latitude: selectedAddressPoint.latitude,
            longitude: selectedAddressPoint.longitude,
          },
        ]
      : []),
  ];

  // Preview trace: route through the points (estimated order). OSRM computation
  // (per tenant) in read-only mode, cached by React Query based on the points.
  const routeWaypoints = orderRouteWaypoints(previewPoints);
  const { data: previewRoute, isFetching: routeFetching } = useQuery({
    ...trpc.routing.previewRoute.queryOptions({ points: routeWaypoints }),
    enabled: routeWaypoints.length >= 2,
  });
  const routeGeometry =
    previewRoute?.ok && previewRoute.geometry
      ? (previewRoute.geometry as [number, number][])
      : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Real-time preview of the points (établissement + usagers of the
          circuit + chosen address). Independent of a computed trajet: the
          geolocation is shown as soon as something is selected. */}
      {!isNew && !circuit ? (
        <div className="flex h-[200px] items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          Sélectionnez un circuit pour afficher l&apos;aperçu.
        </div>
      ) : basemap === undefined ? (
        <Skeleton className="h-[200px] w-full rounded-none" />
      ) : (
        <CircuitPreviewMap
          points={previewPoints}
          routeGeometry={routeGeometry}
          basemap={basemap}
          className="h-[200px] w-full"
        />
      )}

      {(isNew || circuit) && routeWaypoints.length >= 2 && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs">
          <span className="inline-flex h-2.5 w-4 shrink-0 items-center" aria-hidden>
            <span
              className="h-[3px] w-full rounded-full"
              style={{ background: "#7c3aed" }}
            />
          </span>
          {previewRoute?.ok ? (
            <span className="text-foreground">
              Tracé estimé ·{" "}
              <span className="font-medium tabular-nums">
                {formatKm(previewRoute.distanceKm)}
              </span>{" "}
              ·{" "}
              <span className="font-medium tabular-nums">
                {formatDuration(previewRoute.durationSec)}
              </span>
            </span>
          ) : routeFetching ? (
            <span className="text-muted-foreground">Calcul du tracé…</span>
          ) : (
            <span className="text-muted-foreground">Tracé indisponible</span>
          )}
        </div>
      )}

      {(isNew || circuit) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: "#2563eb" }}
            />
            Établissement
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: "#059669" }}
            />
            Adresse choisie
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: "#d97706" }}
            />
            Autres usagers
          </span>
        </div>
      )}

      <div className="space-y-3 p-4">
        {circuit ? (
          <>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {circuit.name}
              </p>
              {(circuit.etablissementName || circuit.etablissementCity) && (
                <p className="text-xs text-muted-foreground">
                  {[circuit.etablissementName, circuit.etablissementCity]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {circuitInfo && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarRange className="size-3.5 shrink-0" />
                  <span className="tabular-nums">
                    {formatCircuitPeriode(
                      circuitInfo.startDate,
                      circuitInfo.endDate,
                    )}
                  </span>
                </p>
              )}
            </div>

            {suggestion && suggestion.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestion.reasons.map((r, i) => (
                  <SuggestionReasonChip key={i} reason={r} />
                ))}
              </div>
            )}

            {!isNew && trajet && arretsList && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <PreviewStat
                    icon={MapPin}
                    value={String(arretsList.length)}
                    label={arretsList.length > 1 ? "arrêts" : "arrêt"}
                  />
                  <PreviewStat
                    icon={Users}
                    value={String(trajet.totalUsager)}
                    label={trajet.totalUsager > 1 ? "usagers" : "usager"}
                  />
                </div>
                {/* Circulation days: we concretely show the days (LU MA…)
                    rather than an ambiguous total. Derived from the PEC days
                    of the circuit's usagers. */}
                {days.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      Jours de circulation
                    </p>
                    <DayBadges days={days} />
                  </div>
                )}
              </div>
            )}

            {!isNew && (
              <NextLink
                href={`/circuits/${circuit.id}`}
                target="_blank"
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Ouvrir la fiche du circuit
                <ExternalLink className="size-3.5" />
              </NextLink>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun circuit sélectionné.
          </p>
        )}
      </div>
    </div>
  );
}

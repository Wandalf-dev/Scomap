"use client";

import { useEffect, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Route,
  Search,
  Sparkles,
  School,
  MapPin,
  Bell,
  ShieldCheck,
  Check,
  ExternalLink,
  Users,
  CalendarDays,
  SquarePlus,
  AlertTriangle,
  CalendarRange,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import {
  isCircuitCompatibleTransport,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import { DayBadges } from "@/components/shared/day-badges";
import { dateRangesOverlap } from "@/lib/utils/date-helpers";
import type { PreviewPoint } from "./circuit-preview-map";

// --- Schemas (réutilisés tels quels depuis l'ancienne modal) ---

const linkFormSchema = z.object({
  circuitId: z.string().uuid("Sélectionnez un circuit"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});
type LinkFormValues = z.infer<typeof linkFormSchema>;

const createNewFormSchema = z.object({
  circuitName: z.string().min(1, "Nom du circuit requis"),
  etablissementId: z.string().uuid("Sélectionnez un établissement"),
  usagerAddressId: z.string().uuid("Sélectionnez une adresse"),
  arrivalNotification: z.boolean(),
  authorizationAlone: z.boolean(),
});
type CreateNewFormValues = z.infer<typeof createNewFormSchema>;

const FORM_ID = "assoc-circuit-form";

// --- Types ---

interface CircuitListItem {
  id: string;
  name: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  startDate: string | null;
  endDate: string | null;
  usagerCount: number;
}

interface CircuitSuggestionReason {
  kind: string;
  label: string;
  detail: string;
  distanceM?: number;
}

interface CircuitSuggestion {
  circuitId: string;
  score: number;
  reasons: CircuitSuggestionReason[];
}

// --- Reason chips ---

const SUGGESTION_REASON_ICONS: Record<string, LucideIcon> = {
  etablissement: School,
  trajet: Route,
  arret: MapPin,
};

const SUGGESTION_REASON_STYLES: Record<string, string> = {
  // Établissement = signal principal → puce primary pleine (lisible clair/sombre).
  etablissement: "border-transparent bg-primary text-primary-foreground",
  trajet:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  arret: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

function formatChipDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 10) * 10} m`;
}

function SuggestionReasonChip({ reason }: { reason: CircuitSuggestionReason }) {
  const Icon = SUGGESTION_REASON_ICONS[reason.kind] ?? Sparkles;
  return (
    <span
      title={reason.detail}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        SUGGESTION_REASON_STYLES[reason.kind] ??
          "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {reason.label}
      {reason.distanceM != null && reason.kind !== "etablissement" && (
        <span className="font-normal opacity-70">
          · ~{formatChipDistance(reason.distanceM)}
        </span>
      )}
    </span>
  );
}

// --- Relevance tag (tier de pertinence) ---

function relevanceTier(score: number): { label: string; className: string } {
  if (score >= 80)
    return {
      label: "Idéal",
      className: "border-transparent bg-emerald-600 text-white",
    };
  if (score >= 40)
    return {
      label: "Recommandé",
      className: "border-transparent bg-primary text-primary-foreground",
    };
  return {
    label: "Possible",
    className: "border border-border bg-muted text-muted-foreground",
  };
}

function RelevanceTag({ score }: { score: number }) {
  const t = relevanceTier(score);
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        t.className,
      )}
    >
      {t.label}
    </span>
  );
}

// --- Map preview (dynamique, ssr:false) ---

const CircuitPreviewMap = dynamic(
  () => import("./circuit-preview-map").then((mod) => mod.CircuitPreviewMap),
  {
    ssr: false,
    loading: () => <div className="h-[200px] w-full animate-pulse bg-muted/40" />,
  },
);

// --- Circuit row ---

function CircuitRow({
  circuit,
  suggestion,
  selected,
  onSelect,
}: {
  circuit: CircuitListItem;
  suggestion?: CircuitSuggestion;
  selected: boolean;
  onSelect: () => void;
}) {
  const subline = [circuit.etablissementName, circuit.etablissementCity]
    .filter(Boolean)
    .join(" · ");
  const periode =
    circuit.startDate || circuit.endDate
      ? formatCircuitPeriode(circuit.startDate, circuit.endDate)
      : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 border-l-2 px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-l-primary bg-primary/[0.06]"
          : "border-l-transparent hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        <Route className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {circuit.name}
        </span>
        {subline && (
          <span className="block truncate text-xs text-muted-foreground">
            {subline}
          </span>
        )}
        {/* Infos pratiques : période de validité + nombre d'usagers affectés. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {periode && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarRange className="size-3 shrink-0" />
              {periode}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3 shrink-0" />
            {circuit.usagerCount} usager{circuit.usagerCount > 1 ? "s" : ""}
          </span>
        </span>
        {suggestion && suggestion.reasons.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {suggestion.reasons.map((r, i) => (
              <SuggestionReasonChip key={i} reason={r} />
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        {suggestion && <RelevanceTag score={suggestion.score} />}
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full border-2",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
      </span>
    </button>
  );
}

// --- Picker (blocs Suggestions / Autres) ---

function CircuitPicker({
  availableCircuits,
  suggestions,
  suggestionsLoading,
  value,
  onSelect,
}: {
  availableCircuits: CircuitListItem[];
  suggestions?: CircuitSuggestion[];
  suggestionsLoading?: boolean;
  value: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? availableCircuits.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.etablissementName?.toLowerCase().includes(q) ?? false) ||
          (c.etablissementCity?.toLowerCase().includes(q) ?? false),
      )
    : availableCircuits;

  const suggMap = new Map<string, CircuitSuggestion>();
  for (const s of suggestions ?? []) suggMap.set(s.circuitId, s);

  const annotated = filtered.map((c) => ({
    circuit: c,
    suggestion: suggMap.get(c.id),
  }));
  const suggested = annotated
    .filter((a) => a.suggestion)
    .sort(
      (a, b) =>
        b.suggestion!.score - a.suggestion!.score ||
        a.circuit.name.localeCompare(b.circuit.name),
    );
  const others = annotated
    .filter((a) => !a.suggestion)
    .sort((a, b) => a.circuit.name.localeCompare(b.circuit.name));
  const showGroups = !q && suggested.length > 0 && others.length > 0;

  if (availableCircuits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Aucun circuit disponible. Basculez sur «&nbsp;Nouveau circuit&nbsp;» pour
        en créer un.
      </div>
    );
  }

  const renderRow = (a: {
    circuit: CircuitListItem;
    suggestion?: CircuitSuggestion;
  }) => (
    <CircuitRow
      key={a.circuit.id}
      circuit={a.circuit}
      suggestion={a.suggestion}
      selected={a.circuit.id === value}
      onSelect={() => onSelect(a.circuit.id)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un circuit…"
          className="pl-9"
        />
      </div>

      {suggestionsLoading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3 animate-pulse text-primary" />
          Analyse des circuits à proximité…
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">
          Aucun circuit ne correspond.
        </p>
      ) : showGroups ? (
        <div
          role="radiogroup"
          aria-label="Circuits disponibles"
          className="space-y-3"
        >
          <div className="overflow-hidden rounded-lg border border-border">
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-4 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Suggestions
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {suggested.length}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                classées par pertinence
              </span>
            </div>
            <div className="max-h-[20rem] divide-y divide-border overflow-y-auto bg-primary/[0.02]">
              {suggested.map(renderRow)}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Autres circuits
                <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {others.length}
                </span>
              </span>
            </div>
            <div className="max-h-[20rem] divide-y divide-border overflow-y-auto">
              {others.map(renderRow)}
            </div>
          </div>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Circuits disponibles"
          className="max-h-[24rem] divide-y divide-border overflow-auto rounded-lg border border-border"
        >
          {suggested.map(renderRow)}
          {others.map(renderRow)}
        </div>
      )}
    </div>
  );
}

// --- Preview panel (colonne droite) ---

interface PreviewCircuit {
  id: string;
  name: string;
  etablissementName: string | null;
  etablissementCity: string | null;
}

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

// "YYYY-MM-DD" → "JJ/MM/AAAA".
function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Libellé de la période de validité d'un circuit selon les dates disponibles.
function formatCircuitPeriode(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return "Période non définie";
}

// Distance à vol d'oiseau (km) — sert uniquement à ordonner les points de l'aperçu.
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ordre d'aperçu des waypoints (heuristique nearest-neighbor) : ramassage des
 * usagers, du plus loin au plus proche de l'établissement, terminé par
 * l'établissement (sens « aller » d'un transport scolaire). ⚠️ Estimation :
 * l'ordre réel des arrêts d'un trajet est calculé ailleurs (trajet-sync).
 */
function orderRouteWaypoints(
  points: PreviewPoint[],
): { lat: number; lng: number }[] {
  const geo = points.filter((p) => p.latitude != null && p.longitude != null);
  const etab = geo.find((p) => p.kind === "etablissement");
  const pickups = geo
    .filter((p) => p.kind !== "etablissement")
    .map((p) => ({ lat: p.latitude!, lng: p.longitude! }));
  if (!etab) return pickups;
  const etabLL = { lat: etab.latitude!, lng: etab.longitude! };
  const chain: { lat: number; lng: number }[] = [];
  let cursor = etabLL;
  const rem = [...pickups];
  while (rem.length) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = haversineKm(cursor, rem[i]!);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    cursor = rem[bi]!;
    chain.push(cursor);
    rem.splice(bi, 1);
  }
  chain.reverse(); // établissement en dernier
  return [...chain, etabLL];
}

function formatKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}
function formatDuration(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

function CircuitPreviewPanel({
  circuit,
  suggestion,
  isNew,
  usagerId,
  etablissementPoint,
  selectedAddressPoint,
}: {
  circuit: PreviewCircuit | null;
  suggestion?: CircuitSuggestion;
  isNew: boolean;
  usagerId: string;
  etablissementPoint: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  selectedAddressPoint: {
    label: string;
    latitude: number;
    longitude: number;
  } | null;
}) {
  const trpc = useTRPC();
  const circuitId = circuit?.id ?? null;
  const enabled = !isNew && !!circuitId;

  // Dates de validité du circuit (début / fin de transport) pour l'aperçu.
  const { data: circuitInfo } = useQuery({
    ...trpc.circuits.getById.queryOptions({ id: circuitId ?? "" }),
    enabled,
  });

  // Aperçu = reflet de l'état courant du circuit (trajets/arrêts changent dès
  // qu'un usager est associé). On force le refetch au montage : sinon le
  // staleTime global (30s) sert un cache périmé en navigation client → panneau
  // vide tant qu'on n'a pas rechargé la page.
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
  // Fond de carte : toujours chargé (l'aperçu de points s'affiche aussi pour un
  // nouveau circuit, sans trajet calculé).
  const { data: basemap } = useQuery(trpc.basemap.getStyle.queryOptions());

  // Usagers déjà sur le circuit (versions ouvertes) → points géoloc de l'aperçu.
  const { data: circuitUsagers } = useQuery({
    ...trpc.usagerCircuits.listByCircuit.queryOptions({
      circuitId: circuitId ?? "",
      openOnly: true,
    }),
    enabled,
    refetchOnMount: "always",
  });

  const days = trajet?.recurrence?.daysOfWeek ?? [];

  // Points de l'aperçu temps réel : établissement de destination + usagers déjà
  // sur le circuit (hors usager courant) + adresse choisie de l'usager courant.
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

  // Tracé d'aperçu : itinéraire à travers les points (ordre estimé). Calcul OSRM
  // (par tenant) en lecture seule, mis en cache par React Query selon les points.
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
      {/* Aperçu temps réel des points (établissement + usagers du circuit +
          adresse choisie). Indépendant d'un trajet calculé : on visualise la
          géoloc dès la sélection. */}
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
                {/* Jours de circulation : on montre concrètement les jours
                    (LU MA…) plutôt qu'un total ambigu. Dérivés des jours de PEC
                    des usagers du circuit. */}
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

// --- Section card ---

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// --- Address radio cards ---

interface AddressItem {
  id: string;
  type: string | null;
  position: number;
  address: string | null;
  city: string | null;
}

function getAddressTypeLabel(type: string | null): string {
  if (!type) return "";
  return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
}

/**
 * Badge de rang d'adresse : position 1 = « Principale » (mise en avant), les
 * suivantes « Adresse 2/3/4 ». Convention position=1 ⇒ principale, identique au
 * reste de l'app (onglet Adresses, calcul de distance domicile↔école).
 */
function AddressRankBadge({ position }: { position: number }) {
  const isPrimary = position === 1;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        isPrimary
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {isPrimary ? "Principale" : `Adresse ${position}`}
    </span>
  );
}

function AddressCards({
  control,
  addresses,
  locked,
  occupiedIds,
  avenantHref,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  addresses: AddressItem[];
  locked: boolean;
  occupiedIds?: Set<string>;
  avenantHref?: string;
}) {
  return (
    <FormField
      control={control}
      name="usagerAddressId"
      render={({ field }) => (
        <FormItem>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune adresse enregistrée pour cet usager.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Adresse de prise en charge"
              className={cn(
                "grid gap-2",
                locked && "pointer-events-none opacity-60",
              )}
            >
              {addresses.map((addr) => {
                const selected = field.value === addr.id;
                const label =
                  getAddressTypeLabel(addr.type) || `Adresse ${addr.position}`;
                const full = [addr.address, addr.city]
                  .filter(Boolean)
                  .join(", ");
                // Adresse déjà sur un circuit (hors édition) : non sélectionnable,
                // on renvoie vers l'avenant.
                const occupied = !locked && (occupiedIds?.has(addr.id) ?? false);

                if (occupied) {
                  return (
                    <div
                      key={addr.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <span className="mt-0.5 size-4 shrink-0 rounded-full border border-muted-foreground/30" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <AddressRankBadge position={addr.position} />
                          <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Déjà sur un circuit
                          </span>
                        </div>
                        {full && (
                          <p className="truncate text-xs text-muted-foreground">
                            {full}
                          </p>
                        )}
                        {avenantHref && (
                          <NextLink
                            href={avenantHref}
                            className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <SquarePlus className="size-3" />
                            Changer via un avenant
                          </NextLink>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    key={addr.id}
                    role="radio"
                    aria-checked={selected}
                    disabled={locked}
                    onClick={() => field.onChange(addr.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      locked ? "cursor-not-allowed" : "cursor-pointer",
                      selected
                        ? "border-primary bg-primary/[0.06] ring-1 ring-inset ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {label}
                        </span>
                        <AddressRankBadge position={addr.position} />
                      </span>
                      {full && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {full}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// --- Options toggles ---

function OptionsToggles({
  control,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      <FormField
        control={control}
        name="arrivalNotification"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Bell className="size-4" />
            </span>
            <div className="flex-1 space-y-0.5">
              <FormLabel className="text-sm">
                Notification d&apos;arrivée
              </FormLabel>
              <FormDescription className="text-xs">
                Envoyer une notification à l&apos;arrivée du véhicule
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="cursor-pointer"
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="authorizationAlone"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <div className="flex-1 space-y-0.5">
              <FormLabel className="text-sm">
                Autorisation de rentrer seul
              </FormLabel>
              <FormDescription className="text-xs">
                L&apos;usager est autorisé à rentrer seul à son domicile
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="cursor-pointer"
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

// --- Main client ---

interface AssocierCircuitClientProps {
  usagerId: string;
  usagerCircuitId: string | null;
}

export function AssocierCircuitClient({
  usagerId,
  usagerCircuitId,
}: AssocierCircuitClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!usagerCircuitId;
  const [mode, setMode] = useState<"existing" | "new">("existing");

  // Rendu du formulaire côté client uniquement : ces champs utilisent useId
  // (FormItem). Les rendre au SSR puis hydrater déclenche un mismatch d'id
  // (Next 15.5). En modale ils étaient déjà client-only ; on reproduit ça.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: usager, isLoading: usagerLoading } = useQuery(
    trpc.usagers.getById.queryOptions({ id: usagerId }),
  );
  const { data: usagerAddresses } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );
  const { data: allCircuits } = useQuery(trpc.circuits.list.queryOptions());
  const { data: linkedCircuits } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );
  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    ...trpc.usagerCircuits.suggestForUsager.queryOptions({ usagerId }),
    enabled: !isEdit,
  });

  const linkForm = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      circuitId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });
  const createForm = useForm<CreateNewFormValues>({
    resolver: zodResolver(createNewFormSchema),
    defaultValues: {
      circuitName: "",
      etablissementId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });

  const editingItem = isEdit
    ? (linkedCircuits?.find((lc) => lc.id === usagerCircuitId) ?? null)
    : null;

  const linkedIds = new Set(linkedCircuits?.map((lc) => lc.circuitId) ?? []);
  const availableCircuits: CircuitListItem[] = (allCircuits ?? [])
    .filter((c) => !linkedIds.has(c.id))
    // On ne propose que les circuits dont la période de validité chevauche
    // la période de transport de l'usager : un circuit terminé avant le début
    // de transport (ou commençant après sa fin) n'a aucun sens pour cet usager.
    .filter((c) =>
      dateRangesOverlap(
        usager?.transportStartDate,
        usager?.transportEndDate,
        c.startDate,
        c.endDate,
      ),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      etablissementName: c.etablissementName,
      etablissementCity: c.etablissementCity,
      startDate: c.startDate,
      endDate: c.endDate,
      usagerCount: c.usagerCount,
    }));

  // Adresses déjà affectées à un circuit actif : non sélectionnables ici
  // (un changement passe par un avenant). Une seule affectation par adresse.
  const occupiedAddressIds = new Set(
    (linkedCircuits ?? [])
      .map((lc) => lc.usagerAddressId)
      .filter((id): id is string => !!id),
  );
  const hasFreeAddress = (usagerAddresses ?? []).some(
    (a) => !occupiedAddressIds.has(a.id),
  );
  const avenantHref = `/avenants/new?usagerId=${usagerId}`;

  const circuitEligible = isCircuitCompatibleTransport(
    usager?.transportType ?? null,
  );
  const transportTypeLabel = usager?.transportType
    ? USAGER_TRANSPORT_TYPE_LABELS[
        usager.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
      ] ?? usager.transportType
    : null;

  const backToTab = () => router.push(`/usagers/${usagerId}?tab=circuits`);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.circuits.list.queryKey() });
    // Associer/dissocier change usagerCount du circuit → rafraîchit la fiche
    // circuit (verrou des dates) sans cibler un id précis.
    queryClient.invalidateQueries({
      queryKey: trpc.circuits.getById.queryKey(),
    });
    // L'association crée/complète des trajets + arrêts (syncTrajetForDirection) :
    // on invalide pour que l'aperçu et les vues circuit reflètent le nouvel état.
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listByCircuit.queryKey(),
    });
    queryClient.invalidateQueries({ queryKey: trpc.arrets.list.queryKey() });
    // Liste des usagers du circuit (onglet Usagers de la fiche circuit).
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByCircuit.queryKey(),
    });
    // Rejoindre un circuit déjà démarré crée un avenant automatique « ajout » :
    // on rafraîchit les timelines d'avenants. listByUsager sans argument = tous
    // les usagers (l'avenant devient visible chez les AUTRES usagers du circuit).
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByUsager.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByCircuit.queryKey(),
    });
  };

  const createMutation = useMutation(
    trpc.usagerCircuits.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit associé");
        backToTab();
      },
      onError: (err) =>
        toast.error(err.message || "Erreur lors de l'association"),
    }),
  );
  const updateMutation = useMutation(
    trpc.usagerCircuits.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit modifié");
        backToTab();
      },
      onError: (err) =>
        toast.error(err.message || "Erreur lors de la modification"),
    }),
  );
  const createCircuitMutation = useMutation(
    trpc.circuits.createFull.mutationOptions({
      onError: () => toast.error("Erreur lors de la création du circuit"),
    }),
  );

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    createCircuitMutation.isPending;

  // Init forms (édition ou défauts).
  useEffect(() => {
    if (isEdit) {
      if (editingItem) {
        linkForm.reset({
          circuitId: editingItem.circuitId,
          usagerAddressId: editingItem.usagerAddressId ?? "",
          arrivalNotification: editingItem.arrivalNotification,
          authorizationAlone: editingItem.authorizationAlone,
        });
        setMode("existing");
      }
    } else {
      createForm.reset({
        circuitName: "",
        etablissementId: usager?.etablissementId ?? "",
        usagerAddressId: "",
        arrivalNotification: false,
        authorizationAlone: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editingItem?.id, usager?.etablissementId]);

  // Présélectionner la meilleure suggestion.
  useEffect(() => {
    if (isEdit || mode !== "existing") return;
    if (linkForm.getValues("circuitId")) return;
    const best = suggestions?.find((s) =>
      availableCircuits.some((c) => c.id === s.circuitId),
    );
    if (best) linkForm.setValue("circuitId", best.circuitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, isEdit, mode, availableCircuits.length]);

  const selectedCircuitId = linkForm.watch("circuitId");
  const suggestionMap = new Map<string, CircuitSuggestion>();
  for (const s of suggestions ?? []) suggestionMap.set(s.circuitId, s);

  const selectedCircuit: PreviewCircuit | null = isEdit
    ? editingItem
      ? {
          id: editingItem.circuitId,
          name: editingItem.circuitName,
          etablissementName: editingItem.etablissementName,
          etablissementCity: editingItem.etablissementCity,
        }
      : null
    : (availableCircuits.find((c) => c.id === selectedCircuitId) ?? null);
  const selectedSuggestion = selectedCircuit
    ? suggestionMap.get(selectedCircuit.id)
    : undefined;

  function switchToExisting() {
    if (mode === "existing") return;
    const v = createForm.getValues();
    linkForm.setValue("usagerAddressId", v.usagerAddressId);
    linkForm.setValue("arrivalNotification", v.arrivalNotification);
    linkForm.setValue("authorizationAlone", v.authorizationAlone);
    setMode("existing");
  }
  function switchToNew() {
    if (mode === "new") return;
    const v = linkForm.getValues();
    createForm.setValue("usagerAddressId", v.usagerAddressId);
    createForm.setValue("arrivalNotification", v.arrivalNotification);
    createForm.setValue("authorizationAlone", v.authorizationAlone);
    setMode("new");
  }

  function onSubmitExisting(values: LinkFormValues) {
    createMutation.mutate({
      usagerId,
      circuitId: values.circuitId,
      usagerAddressId: values.usagerAddressId,
      arrivalNotification: values.arrivalNotification,
      authorizationAlone: values.authorizationAlone,
    });
  }
  async function onSubmitNew(values: CreateNewFormValues) {
    const circuit = await createCircuitMutation.mutateAsync({
      name: values.circuitName,
      etablissementId: values.etablissementId,
      startDate: usager?.transportStartDate || null,
    });
    createMutation.mutate({
      usagerId,
      circuitId: circuit.id,
      usagerAddressId: values.usagerAddressId,
      arrivalNotification: values.arrivalNotification,
      authorizationAlone: values.authorizationAlone,
    });
  }
  function onSubmitEdit(values: LinkFormValues) {
    if (!usagerCircuitId) return;
    updateMutation.mutate({
      id: usagerCircuitId,
      data: {
        usagerAddressId: values.usagerAddressId,
        arrivalNotification: values.arrivalNotification,
        authorizationAlone: values.authorizationAlone,
      },
    });
  }

  // Soumission invalide : on amène le premier champ en erreur dans le viewport.
  // Le bouton « Associer » est sticky en haut, donc l'erreur inline (FormMessage,
  // déjà en place) peut se trouver hors écran. On ne décale rien et on n'ajoute
  // aucun élément d'UI ; on s'appuie sur le message rouge existant sous le champ.
  function scrollToFirstError() {
    // Double rAF : laisser React monter les <FormMessage> avant de cibler.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const form = document.getElementById(FORM_ID);
        const message = form?.querySelector('[data-slot="form-message"]');
        const target =
          message?.closest('[data-slot="form-item"]') ?? message ?? null;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
    );
  }

  const useCreateForm = mode === "new" && !isEdit;

  const ctaLabel = isPending
    ? "Enregistrement..."
    : isEdit
      ? "Enregistrer"
      : useCreateForm
        ? "Créer & associer"
        : "Associer le circuit";

  // Cartes Adresse + Options, partagées par les 3 modes.
  const renderAddressAndOptions = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: any,
    locked: boolean,
  ) => (
    <>
      <SectionCard icon={MapPin} title="Adresse de prise en charge">
        <AddressCards
          control={control}
          addresses={usagerAddresses ?? []}
          locked={locked}
          occupiedIds={occupiedAddressIds}
          avenantHref={avenantHref}
        />
      </SectionCard>
      <SectionCard icon={Bell} title="Options">
        <OptionsToggles control={control} />
      </SectionCard>
    </>
  );

  if (
    !mounted ||
    usagerLoading ||
    !usager ||
    (isEdit && linkedCircuits === undefined)
  ) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Lien d'édition introuvable.
  if (isEdit && linkedCircuits !== undefined && !editingItem) {
    return (
      <div className="w-full space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={backToTab}
          className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à la fiche
        </Button>
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Association introuvable.
        </div>
      </div>
    );
  }

  const usagerName = `${usager.firstName} ${usager.lastName}`.trim();
  const subtitle = [usagerName || null, transportTypeLabel]
    .filter(Boolean)
    .join(" · ");

  // --- Points géoloc pour l'aperçu temps réel (carte de droite) ---
  // Adresse choisie de l'usager courant (mise à jour à chaque clic sur une carte
  // d'adresse, via watch).
  const watchedAddressId = useCreateForm
    ? createForm.watch("usagerAddressId")
    : linkForm.watch("usagerAddressId");
  const selAddr = (usagerAddresses ?? []).find((a) => a.id === watchedAddressId);
  const selectedAddressPoint =
    selAddr && selAddr.latitude != null && selAddr.longitude != null
      ? {
          label: `${usagerName || "Usager"}${
            [selAddr.address, selAddr.city].filter(Boolean).length
              ? ` — ${[selAddr.address, selAddr.city].filter(Boolean).join(", ")}`
              : ""
          }`,
          latitude: selAddr.latitude,
          longitude: selAddr.longitude,
        }
      : null;

  // Établissement de destination : circuit choisi (existant/édition) ou
  // établissement sélectionné (nouveau circuit).
  const previewEtablissementId = isEdit
    ? (allCircuits?.find((c) => c.id === editingItem?.circuitId)
        ?.etablissementId ?? null)
    : useCreateForm
      ? createForm.watch("etablissementId") || null
      : (allCircuits?.find((c) => c.id === selectedCircuitId)?.etablissementId ??
        null);
  const previewEtab = (etablissements ?? []).find(
    (e) => e.id === previewEtablissementId,
  );
  const etablissementPoint =
    previewEtab && previewEtab.latitude != null && previewEtab.longitude != null
      ? {
          name: previewEtab.name,
          latitude: previewEtab.latitude,
          longitude: previewEtab.longitude,
        }
      : null;

  return (
    // Pleine largeur, comme la fiche usager (EntityDetailLayout) → UI cohérente.
    // `w-full` (sans mx-auto) évite aussi le piège flexbox : mx-auto sur un
    // flex-item du shell annulait le stretch et la largeur sautait selon le contenu.
    <div className="w-full">
      {/* En-tête collant — boutons d'action à droite (façon fiche usager) */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={backToTab}
            className="-ml-2 shrink-0 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour à la fiche
          </Button>
          <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
            {isEdit ? "Modifier l'association" : "Associer un circuit"}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={backToTab}
            disabled={isPending}
            className="cursor-pointer"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            disabled={
              isPending || !circuitEligible || (!isEdit && !hasFreeAddress)
            }
            className="cursor-pointer"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>

      {subtitle && (
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      )}

      {!circuitEligible && (
        <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p className="text-sm text-foreground">
            Le type de transport de cet usager
            {transportTypeLabel && (
              <>
                {" "}
                (<strong>{transportTypeLabel}</strong>)
              </>
            )}{" "}
            ne nécessite pas de circuit. L&apos;affectation est réservée au
            transport «&nbsp;Taxi collectif / individuel&nbsp;».
          </p>
        </div>
      )}

      {/* Segmented (masqué en édition) */}
      {!isEdit && (
        <div className="mb-6 grid w-full max-w-md grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={switchToExisting}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "existing"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Route className="size-4" />
            Circuit existant
          </button>
          <button
            type="button"
            onClick={switchToNew}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "new"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SquarePlus className="size-4" />
            Nouveau circuit
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche : formulaire */}
        <div className="lg:col-span-2">
          {isEdit ? (
            <Form {...linkForm}>
              <form
                id={FORM_ID}
                onSubmit={linkForm.handleSubmit(onSubmitEdit, scrollToFirstError)}
                className="space-y-6"
              >
                <SectionCard icon={Route} title="Circuit">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <p className="text-sm">
                        Circuit : <strong>{editingItem?.circuitName}</strong>
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                      <p className="font-medium">Champs verrouillés</p>
                      <p className="mt-0.5">
                        Le circuit, les jours et l&apos;adresse de prise en
                        charge se modifient via un avenant (traçabilité).
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/avenants/new?usagerId=${usagerId}`)
                        }
                        className="mt-1.5 inline-flex cursor-pointer items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
                      >
                        <SquarePlus className="size-3.5" />
                        Créer un avenant
                      </button>
                    </div>
                  </div>
                </SectionCard>
                {renderAddressAndOptions(linkForm.control, true)}
              </form>
            </Form>
          ) : useCreateForm ? (
            <Form {...createForm}>
              <form
                id={FORM_ID}
                onSubmit={createForm.handleSubmit(onSubmitNew, scrollToFirstError)}
                className="space-y-6"
              >
                <SectionCard icon={SquarePlus} title="Créer un nouveau circuit">
                  <div className="grid gap-4">
                    <FormField
                      control={createForm.control}
                      name="circuitName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du circuit</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Circuit École Pasteur - Matin"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="etablissementId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Établissement</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full cursor-pointer">
                                <SelectValue placeholder="Sélectionnez un établissement" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {etablissements?.map((e) => (
                                <SelectItem
                                  key={e.id}
                                  value={e.id}
                                  className="cursor-pointer"
                                >
                                  {e.name}
                                  {e.city && ` — ${e.city}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </SectionCard>
                {renderAddressAndOptions(createForm.control, false)}
              </form>
            </Form>
          ) : (
            <Form {...linkForm}>
              <form
                id={FORM_ID}
                onSubmit={linkForm.handleSubmit(onSubmitExisting, scrollToFirstError)}
                className="space-y-6"
              >
                <SectionCard icon={Route} title="Choisir le circuit">
                  <FormField
                    control={linkForm.control}
                    name="circuitId"
                    render={({ field }) => (
                      <FormItem>
                        <CircuitPicker
                          availableCircuits={availableCircuits}
                          suggestions={suggestions}
                          suggestionsLoading={suggestionsLoading}
                          value={field.value}
                          onSelect={(id) => field.onChange(id)}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SectionCard>
                {renderAddressAndOptions(linkForm.control, false)}
              </form>
            </Form>
          )}
        </div>

        {/* Colonne droite : aperçu */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <CircuitPreviewPanel
              circuit={selectedCircuit}
              suggestion={selectedSuggestion}
              isNew={useCreateForm}
              usagerId={usagerId}
              etablissementPoint={etablissementPoint}
              selectedAddressPoint={selectedAddressPoint}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

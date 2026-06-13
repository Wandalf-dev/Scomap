"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import {
  Plus,
  Lock,
  GripVertical,
  User,
  School,
  MapPin,
  Route,
  Clock,
  RotateCcw,
  CircleMinus,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArretTimeInput } from "@/components/trajets/arrets/arret-time-input";
import {
  restrictToVerticalAxis,
  formatDuration,
  formatKm,
  formatGps,
} from "@/components/trajets/arrets/arret-helpers";
import { OccurrenceAddStopDialog } from "./occurrence-add-stop-dialog";
import type { OccurrenceArretAddValues } from "@/lib/validators/trajet";

const TrajetMap = dynamic(
  () => import("@/components/trajets/trajet-map").then((m) => m.TrajetMap),
  { ssr: false },
);

interface OccurrenceArretsTableProps {
  trajetId: string;
  date: string;
  editing: boolean;
}

interface DayStop {
  id: string;
  source: "base" | "ajout";
  type: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderIndex: number;
  arrivalTime: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  timeLocked: boolean;
  usagerId: string | null;
  etablissementId: string | null;
}

/**
 * Day-scoped stops of an occurrence, mirroring the trajet detail page:
 * same table (drag & drop reorder, editable times, lock, km/tps/GPS),
 * route map with the day's distance/duration, and the calc buttons.
 */
export function OccurrenceArretsTable({
  trajetId,
  date,
  editing,
}: OccurrenceArretsTableProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery(
    trpc.trajets.listOccurrenceArrets.queryOptions({ trajetId, date }),
  );
  const { data: basemap } = useQuery(trpc.basemap.getStyle.queryOptions());

  const stops = (data?.stops ?? []) as DayStop[];

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listOccurrenceArrets.queryKey(),
    });
  }

  const mutationOpts = (successMsg?: string) => ({
    onSuccess: () => {
      invalidate();
      if (successMsg) toast.success(successMsg);
    },
    onError: (err: unknown) =>
      toastTrpcError(err as Parameters<typeof toastTrpcError>[0], "Erreur"),
  });

  const addMutation = useMutation(
    trpc.trajets.addOccurrenceArret.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Point ajouté pour ce jour");
        setAddOpen(false);
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de l'ajout du point"),
    }),
  );
  const removeMutation = useMutation(
    trpc.trajets.removeOccurrenceArret.mutationOptions(
      mutationOpts("Arrêt retiré pour ce jour"),
    ),
  );
  const reorderMutation = useMutation(
    trpc.trajets.reorderOccurrenceArrets.mutationOptions(mutationOpts()),
  );
  const updateArretMutation = useMutation(
    trpc.trajets.updateOccurrenceArret.mutationOptions(mutationOpts()),
  );
  const resetMutation = useMutation(
    trpc.trajets.resetOccurrenceArrets.mutationOptions(
      mutationOpts("Arrêts du jour réinitialisés"),
    ),
  );
  const calcRouteMutation = useMutation(
    trpc.trajets.calculateOccurrenceRoute.mutationOptions(
      mutationOpts("Itinéraire du jour calculé"),
    ),
  );
  const calcTimesMutation = useMutation(
    trpc.trajets.calculateOccurrenceTimes.mutationOptions(
      mutationOpts("Horaires du jour calculés"),
    ),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(stops, oldIndex, newIndex);
    reorderMutation.mutate({
      trajetId,
      date,
      items: reordered.map((s, i) => ({ id: s.id, orderIndex: i })),
    });
  }

  const calcPending = calcRouteMutation.isPending || calcTimesMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Section header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Arrêts du jour ({stops.length})
          {data?.materialized && (
            <span className="ml-1 normal-case tracking-normal text-amber-600 dark:text-amber-400">
              · personnalisés
            </span>
          )}
        </p>
        {editing && (
          <div className="flex flex-wrap items-center gap-2">
            {data?.materialized && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate({ trajetId, date })}
                title="Revenir à la composition de base du trajet"
                className="cursor-pointer text-amber-700 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400"
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={calcPending}
              onClick={() => calcRouteMutation.mutate({ trajetId, date })}
              className="cursor-pointer"
            >
              <Route className="h-4 w-4" />
              {calcRouteMutation.isPending ? "Calcul..." : "Calcul Trajet"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={calcPending}
              onClick={() => calcTimesMutation.mutate({ trajetId, date })}
              className="cursor-pointer"
            >
              <Clock className="h-4 w-4" />
              {calcTimesMutation.isPending ? "Calcul..." : "Calcul Horaire"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Ajouter un point
            </Button>
          </div>
        )}
      </div>

      {stops.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">
          Aucun arrêt pour ce jour.
        </p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Stops table (same design as the trajet detail page) */}
          <div className="self-start overflow-x-auto rounded-[0.3rem] border border-border bg-card">
            <DndContext
              id="occurrence-arrets-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              autoScroll={false}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {editing && <TableHead className="w-[32px]" />}
                    <TableHead className="w-[40px] text-center">#</TableHead>
                    <TableHead>Nom / Adresse</TableHead>
                    <TableHead className="w-[130px]">Horaire</TableHead>
                    {editing && (
                      <TableHead
                        className="w-[40px] text-center"
                        title="Verrouiller l'horaire : il ne sera pas recalculé lors du calcul des horaires"
                      >
                        <Lock className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                      </TableHead>
                    )}
                    <TableHead className="w-[72px] text-right">Km</TableHead>
                    <TableHead className="w-[64px] text-right">Tps (s)</TableHead>
                    <TableHead className="w-[120px]">GPS</TableHead>
                    {editing && <TableHead className="w-[40px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={stops.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {stops.map((stop, idx) => (
                      <SortableDayStopRow
                        key={stop.id}
                        stop={stop}
                        position={idx + 1}
                        editing={editing}
                        pending={removeMutation.isPending || updateArretMutation.isPending}
                        onRemove={() =>
                          removeMutation.mutate({ trajetId, date, stopId: stop.id })
                        }
                        onToggleLock={() =>
                          updateArretMutation.mutate({
                            trajetId,
                            date,
                            stopId: stop.id,
                            timeLocked: !stop.timeLocked,
                          })
                        }
                        onSetTime={(t) =>
                          updateArretMutation.mutate({
                            trajetId,
                            date,
                            stopId: stop.id,
                            arrivalTime: t,
                          })
                        }
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </div>

          {/* Day route map + totals */}
          <div className="space-y-2">
            <div className="rounded-[0.3rem] border border-border bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
              {data?.totalDistanceKm != null && data?.totalDurationSeconds != null ? (
                <>
                  Distance : {data.totalDistanceKm.toFixed(3)} km — Durée :{" "}
                  {(data.totalDurationSeconds / 60).toFixed(1)} min
                </>
              ) : (
                <span className="text-muted-foreground">
                  Itinéraire non calculé pour ce jour
                </span>
              )}
            </div>
            <TrajetMap
              arrets={stops.map((s) => ({
                id: s.id,
                name: s.name,
                latitude: s.latitude,
                longitude: s.longitude,
                orderIndex: s.orderIndex,
                type: s.type,
              }))}
              routeGeometry={data?.routeGeometry ?? undefined}
              basemap={basemap}
              className="h-[280px] overflow-hidden rounded-[0.3rem] border border-border"
            />
          </div>
        </div>
      )}

      {editing && (
        <p className="text-xs text-muted-foreground">
          L&apos;ordre, les horaires et les points modifiés ne s&apos;appliquent
          qu&apos;à ce jour — le trajet et ses arrêts de base restent inchangés.
        </p>
      )}

      <OccurrenceAddStopDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values: OccurrenceArretAddValues) =>
          addMutation.mutate({ trajetId, date, data: values })
        }
        isPending={addMutation.isPending}
      />
    </div>
  );
}

interface SortableDayStopRowProps {
  stop: DayStop;
  position: number;
  editing: boolean;
  pending: boolean;
  onRemove: () => void;
  onToggleLock: () => void;
  onSetTime: (time: string | null) => void;
}

function SortableDayStopRow({
  stop,
  position,
  editing,
  pending,
  onRemove,
  onToggleLock,
  onSetTime,
}: SortableDayStopRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id, disabled: !editing });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const ecole = stop.type === "etablissement";

  return (
    <TableRow ref={setNodeRef} style={style} className="group">
      {editing && (
        <TableCell className="px-1 align-middle">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-7 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
            aria-label="Réordonner l'arrêt"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
      )}
      <TableCell className="text-center font-mono text-sm text-muted-foreground">
        {String(position).padStart(2, "0")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {stop.type === "usager" ? (
            <User className="h-4 w-4 shrink-0 text-amber-600" />
          ) : ecole ? (
            <School className="h-4 w-4 shrink-0 text-blue-600" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            {stop.type === "usager" && stop.usagerId ? (
              <Link
                href={`/usagers/${stop.usagerId}`}
                className="cursor-pointer text-sm font-medium text-primary hover:underline"
              >
                {stop.name}
              </Link>
            ) : ecole && stop.etablissementId ? (
              <Link
                href={`/etablissements/${stop.etablissementId}`}
                className="cursor-pointer text-sm font-medium text-primary hover:underline"
              >
                {stop.name}
              </Link>
            ) : (
              <span className="text-sm font-medium">{stop.name}</span>
            )}
            {stop.address && (
              <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                {stop.address}
              </p>
            )}
          </div>
          {ecole && (
            <Badge
              variant="outline"
              className="shrink-0 border-blue-300 text-xs text-blue-700 dark:border-blue-700 dark:text-blue-400"
            >
              École
            </Badge>
          )}
          {stop.source === "ajout" && (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-300 text-xs text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
            >
              Ajouté ce jour
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {editing ? (
          <ArretTimeInput
            value={stop.arrivalTime}
            locked={stop.timeLocked}
            onCommit={onSetTime}
          />
        ) : (
          <span className="font-mono text-sm tabular-nums">
            {stop.arrivalTime ?? "—"}
          </span>
        )}
      </TableCell>
      {editing && (
        <TableCell className="text-center">
          <Checkbox
            checked={stop.timeLocked}
            onCheckedChange={onToggleLock}
            disabled={pending}
            className="cursor-pointer"
            title="Verrouiller cet horaire : ignoré lors du calcul des horaires"
          />
        </TableCell>
      )}
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatKm(stop.distanceKm)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatDuration(stop.durationSeconds)}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatGps(stop.latitude, stop.longitude)}
      </TableCell>
      {editing && (
        <TableCell>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            title="Retirer ce jour"
            onClick={onRemove}
            className="h-7 w-7 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <CircleMinus className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

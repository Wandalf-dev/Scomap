"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChauffeurSelector } from "@/components/trajets/chauffeur-selector";
import { VehiculeSelector } from "@/components/trajets/vehicule-selector";
import {
  RotateCcw,
  Clock,
  UserRound,
  Bus,
  StickyNote,
  XCircle,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { OccurrenceArretsTable } from "./occurrence-arrets-table";
import { hasOverride, type OccurrenceItem } from "./types";
import {
  occurrenceOverrideSchema,
  type OccurrenceOverrideFormValues,
} from "@/lib/validators/trajet";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planifie: { label: "Planifié", className: "border-muted-foreground" },
  en_cours: {
    label: "En cours",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  termine: {
    label: "Terminé",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  annule: {
    label: "Annulé",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface OccurrenceFicheDialogProps {
  occurrence: OccurrenceItem | null;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** One read-only info line: icon + label, value aligned right. */
function InfoRow({
  icon: Icon,
  label,
  children,
  modified,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  modified?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right text-sm font-medium">
        {children}
        {modified && (
          <span
            title="Personnalisé pour ce jour"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          />
        )}
      </span>
    </div>
  );
}

/**
 * "Fiche trajet du jour" (legacy Transcolaire E7 modal), in two steps within
 * the same dialog: read-only view first, then the "Personnaliser" button
 * switches the SAME dialog to edit mode (assignments, time, notes, per-day
 * stop composition).
 */
export function OccurrenceFicheDialog({
  occurrence,
  onClose,
}: OccurrenceFicheDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  // Anti ghost-click: when the footer buttons swap on mode change, the second
  // click of an habitual double-click lands on the button that just took the
  // same spot ("Personnaliser" → "Enregistrer" would submit immediately).
  // Ignore footer actions for a short window after each mode switch.
  const modeSwitchAtRef = useRef(0);
  function swapGuardActive() {
    return Date.now() - modeSwitchAtRef.current < 400;
  }
  function enterEditing() {
    if (swapGuardActive()) return;
    modeSwitchAtRef.current = Date.now();
    setEditing(true);
  }

  const open = !!occurrence;
  const isAller = occurrence?.trajetDirection === "aller";
  const statusConf = occurrence
    ? STATUS_CONFIG[occurrence.status] ?? STATUS_CONFIG.planifie!
    : STATUS_CONFIG.planifie!;
  const chauffeurName = occurrence?.chauffeurFirstName
    ? `${occurrence.chauffeurFirstName} ${occurrence.chauffeurLastName ?? ""}`.trim()
    : null;
  const baseTime = occurrence?.trajetDepartureTime ?? null;
  const overrideTime = occurrence?.overrideDepartureTime ?? null;
  const timeModified =
    overrideTime !== null && baseTime !== null && overrideTime !== baseTime;

  const form = useForm<OccurrenceOverrideFormValues>({
    resolver: zodResolver(occurrenceOverrideSchema),
    defaultValues: {
      chauffeurId: null,
      vehiculeId: null,
      departureTime: null,
      status: "planifie",
      notes: null,
    },
  });

  // Each opening starts in READ mode with a fresh form.
  useEffect(() => {
    if (occurrence) {
      setEditing(false);
      form.reset({
        chauffeurId: occurrence.overrideChauffeurId,
        vehiculeId: occurrence.overrideVehiculeId,
        departureTime: occurrence.overrideDepartureTime,
        status: (occurrence.status ?? "planifie") as
          | "planifie"
          | "en_cours"
          | "termine"
          | "annule",
        notes: occurrence.overrideNotes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrence]);

  function invalidateOccurrences() {
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listOccurrences.queryKey(),
    });
  }
  const updateMutation = useMutation(
    trpc.trajets.updateOccurrence.mutationOptions({
      onSuccess: () => {
        invalidateOccurrences();
        toast.success("Occurrence personnalisée");
        onClose();
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la personnalisation"),
    }),
  );

  const cancelMutation = useMutation(
    trpc.trajets.cancelOccurrence.mutationOptions({
      onSuccess: () => {
        invalidateOccurrences();
        toast.success("Occurrence annulée");
        onClose();
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de l'annulation"),
    }),
  );

  function handleSubmit(values: OccurrenceOverrideFormValues) {
    if (!occurrence || swapGuardActive()) return;
    updateMutation.mutate({
      trajetId: occurrence.trajetId,
      date: occurrence.date,
      data: values,
    });
  }

  function handleReset() {
    if (!occurrence) return;
    updateMutation.mutate({
      trajetId: occurrence.trajetId,
      date: occurrence.date,
      data: {
        chauffeurId: null,
        vehiculeId: null,
        departureTime: null,
        notes: null,
      },
    });
  }

  function exitEditing() {
    if (swapGuardActive()) return;
    modeSwitchAtRef.current = Date.now();
    if (occurrence) {
      form.reset({
        chauffeurId: occurrence.overrideChauffeurId,
        vehiculeId: occurrence.overrideVehiculeId,
        departureTime: occurrence.overrideDepartureTime,
        status: (occurrence.status ?? "planifie") as
          | "planifie"
          | "en_cours"
          | "termine"
          | "annule",
        notes: occurrence.overrideNotes,
      });
    }
    setEditing(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl xl:max-w-6xl">
        {occurrence && (
          <>
            {/* ---- Header ---- */}
            <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base leading-tight">
                  {occurrence.trajetName}
                </DialogTitle>
                <Badge variant="outline" className={statusConf.className}>
                  {statusConf.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    isAller
                      ? "border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400"
                      : "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                  }
                >
                  {isAller ? "Aller" : "Retour"}
                </Badge>
                {hasOverride(occurrence) && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                  >
                    <SlidersHorizontal className="mr-1 size-3" />
                    Personnalisé
                  </Badge>
                )}
              </div>
              <DialogDescription>
                <span className="capitalize">{formatDate(occurrence.date)}</span>
                {occurrence.circuitName && <> · {occurrence.circuitName}</>}
              </DialogDescription>
            </DialogHeader>

            {/* ---- Body ---- */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {!editing ? (
                <>
                  {/* READ: key facts */}
                  <div className="divide-y divide-border rounded-[0.3rem] border border-border bg-muted/30">
                    <InfoRow
                      icon={Clock}
                      label="Départ"
                      modified={!!overrideTime}
                    >
                      {timeModified && (
                        <span className="font-mono text-xs text-muted-foreground line-through">
                          {baseTime}
                        </span>
                      )}
                      <span className="font-mono">
                        {overrideTime ?? baseTime ?? "—"}
                      </span>
                    </InfoRow>
                    <InfoRow
                      icon={UserRound}
                      label="Chauffeur"
                      modified={!!occurrence.overrideChauffeurId}
                    >
                      {chauffeurName ? (
                        <span className="truncate">{chauffeurName}</span>
                      ) : (
                        <span className="font-normal italic text-muted-foreground">
                          Non affecté
                        </span>
                      )}
                    </InfoRow>
                    <InfoRow
                      icon={Bus}
                      label="Véhicule"
                      modified={!!occurrence.overrideVehiculeId}
                    >
                      {occurrence.vehiculeName ? (
                        <span className="truncate">
                          {occurrence.vehiculeName}
                        </span>
                      ) : (
                        <span className="font-normal italic text-muted-foreground">
                          Non affecté
                        </span>
                      )}
                    </InfoRow>
                  </div>

                  {occurrence.overrideNotes && (
                    <div className="rounded-[0.3rem] border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/30">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <StickyNote className="h-3.5 w-3.5" />
                        Note pour ce jour
                      </p>
                      <p className="whitespace-pre-wrap text-sm">
                        {occurrence.overrideNotes}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* EDIT: one-off overrides form */
                <Form {...form}>
                  <form
                    id="occurrence-fiche-form"
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? "planifie"}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full cursor-pointer">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="planifie" className="cursor-pointer">
                                Planifié
                              </SelectItem>
                              <SelectItem value="en_cours" className="cursor-pointer">
                                En cours
                              </SelectItem>
                              <SelectItem value="termine" className="cursor-pointer">
                                Terminé
                              </SelectItem>
                              <SelectItem value="annule" className="cursor-pointer">
                                Annulé
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departureTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Heure de départ
                            {baseTime && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                (base : {baseTime})
                              </span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="chauffeurId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chauffeur pour ce jour</FormLabel>
                          <FormControl>
                            <ChauffeurSelector
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vehiculeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Véhicule pour ce jour</FormLabel>
                          <FormControl>
                            <VehiculeSelector
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Observation</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Objet de la personnalisation..."
                              rows={2}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              {/* ---- Stops of the day: table + day route map ---- */}
              <OccurrenceArretsTable
                trajetId={occurrence.trajetId}
                date={occurrence.date}
                editing={editing}
              />
            </div>

            {/* ---- Footer ---- */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-4">
              {!editing ? (
                <>
                  {occurrence.status !== "annule" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancelMutation.isPending}
                          className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" />
                          Annuler l&apos;occurrence
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Annuler cette occurrence ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Le trajet «&nbsp;{occurrence.trajetName}&nbsp;» du{" "}
                            {formatDate(occurrence.date)} sera marqué comme
                            annulé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="cursor-pointer">
                            Retour
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              cancelMutation.mutate({
                                trajetId: occurrence.trajetId,
                                date: occurrence.date,
                              })
                            }
                            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmer l&apos;annulation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (swapGuardActive()) return;
                        router.push(`/trajets/${occurrence.trajetId}`);
                      }}
                      className="cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Voir le trajet
                    </Button>
                    <Button
                      type="button"
                      onClick={enterEditing}
                      className="cursor-pointer"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Personnaliser
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={updateMutation.isPending}
                    className="cursor-pointer text-amber-700 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Réinitialiser
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={exitEditing}
                      disabled={updateMutation.isPending}
                      className="cursor-pointer"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      form="occurrence-fiche-form"
                      disabled={updateMutation.isPending}
                      className="cursor-pointer"
                    >
                      {updateMutation.isPending
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </Button>
                  </div>
                </>
              )}
            </div>

          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

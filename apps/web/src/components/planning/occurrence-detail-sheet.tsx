"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { useRouter } from "nextjs-toploader/app";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  XCircle,
  User,
  School,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { hasOverride, type OccurrenceItem } from "./types";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
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
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface OccurrenceDetailSheetProps {
  occurrence: OccurrenceItem | null;
  onClose: () => void;
  /** Opens the customization dialog for the displayed occurrence. */
  onCustomize?: () => void;
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

export function OccurrenceDetailSheet({
  occurrence,
  onClose,
  onCustomize,
}: OccurrenceDetailSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Arrêts RESOLVED at the occurrence date (active attendance on that day).
  const { data: stops } = useQuery(
    trpc.arrets.forDate.queryOptions(
      {
        trajetId: occurrence?.trajetId ?? "",
        date: occurrence?.date ?? "",
      },
      { enabled: !!occurrence },
    ),
  );

  const cancelMutation = useMutation(
    trpc.trajets.cancelOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence annulée");
        onClose();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'annulation");
      },
    }),
  );

  const statusConf = occurrence
    ? STATUS_CONFIG[occurrence.status] ?? STATUS_CONFIG.planifie!
    : STATUS_CONFIG.planifie!;

  return (
    <Sheet open={!!occurrence} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{occurrence?.trajetName}</SheetTitle>
        </SheetHeader>

        {occurrence && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusConf.className}>
                {statusConf.label}
              </Badge>
              <Badge
                variant="outline"
                className={
                  occurrence.trajetDirection === "aller"
                    ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                    : "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
                }
              >
                {occurrence.trajetDirection === "aller" ? "Aller" : "Retour"}
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

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(occurrence.date)}</dd>
              </div>
              {(occurrence.overrideDepartureTime ||
                occurrence.trajetDepartureTime) && (
                <div>
                  <dt className="text-muted-foreground">Heure de départ</dt>
                  <dd className="font-mono font-medium">
                    {occurrence.overrideDepartureTime ??
                      occurrence.trajetDepartureTime}
                  </dd>
                </div>
              )}
              {occurrence.circuitName && (
                <div>
                  <dt className="text-muted-foreground">Circuit</dt>
                  <dd>{occurrence.circuitName}</dd>
                </div>
              )}
              {occurrence.chauffeurFirstName && (
                <div>
                  <dt className="text-muted-foreground">Chauffeur</dt>
                  <dd>
                    {occurrence.chauffeurFirstName}{" "}
                    {occurrence.chauffeurLastName}
                  </dd>
                </div>
              )}
              {occurrence.vehiculeName && (
                <div>
                  <dt className="text-muted-foreground">Véhicule</dt>
                  <dd>{occurrence.vehiculeName}</dd>
                </div>
              )}
              {occurrence.overrideNotes && (
                <div>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap">
                    {occurrence.overrideNotes}
                  </dd>
                </div>
              )}
            </dl>

            {/* Arrêts for the day (resolved by date — reflects avenants) */}
            {stops && stops.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Arrêts ({stops.length})
                </p>
                <ul className="space-y-1">
                  {stops.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-[0.3rem] border border-border/60 px-2.5 py-1.5 text-sm"
                    >
                      {s.type === "usager" ? (
                        <User className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      ) : s.type === "etablissement" ? (
                        <School className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.arrivalTime && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {s.arrivalTime}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/trajets/${occurrence.trajetId}`)
                }
                className="cursor-pointer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Voir le trajet
              </Button>
              {onCustomize && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCustomize}
                  className="cursor-pointer"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Personnaliser
                </Button>
              )}
              {occurrence.status !== "annule" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      className="cursor-pointer text-destructive hover:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Annuler
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Annuler cette occurrence ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Le trajet «&nbsp;{occurrence.trajetName}&nbsp;» du{" "}
                        {formatDate(occurrence.date)} sera marqué comme annulé.
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
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

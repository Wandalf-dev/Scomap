"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  planifie: { label: "Planifie", className: "border-muted-foreground" },
  en_cours: {
    label: "En cours",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  termine: {
    label: "Termine",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  annule: {
    label: "Annule",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface OccurrenceData {
  id: string;
  trajetId: string;
  date: string;
  status: string;
  trajetName: string;
  trajetDirection: string;
  trajetDepartureTime: string | null;
  overrideDepartureTime: string | null;
  circuitName: string | null;
  chauffeurFirstName: string | null;
  chauffeurLastName: string | null;
  vehiculeName: string | null;
  overrideNotes: string | null;
}

interface OccurrenceDetailSheetProps {
  occurrence: OccurrenceData | null;
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

export function OccurrenceDetailSheet({
  occurrence,
  onClose,
}: OccurrenceDetailSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const cancelMutation = useMutation(
    trpc.trajets.cancelOccurrence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listOccurrences.queryKey(),
        });
        toast.success("Occurrence annulee");
        onClose();
      },
      onError: () => {
        toast.error("Erreur lors de l'annulation");
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
            <div className="flex items-center gap-2">
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
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(occurrence.date)}</dd>
              </div>
              {(occurrence.overrideDepartureTime ||
                occurrence.trajetDepartureTime) && (
                <div>
                  <dt className="text-muted-foreground">Heure de depart</dt>
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
                  <dt className="text-muted-foreground">Vehicule</dt>
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

            <div className="flex gap-2 pt-4">
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
              {occurrence.status !== "annule" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    cancelMutation.mutate({ id: occurrence.id })
                  }
                  disabled={cancelMutation.isPending}
                  className="cursor-pointer text-destructive hover:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

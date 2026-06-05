"use client";

import { useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
import { FileText, CalendarClock, X, Plus } from "lucide-react";
import { AvenantChangeDiff } from "@/components/shared/avenant-change-diff";
import {
  AVENANT_TYPE_LABELS,
  AVENANT_STATUS_LABELS,
  type AvenantChangeType,
  type AvenantStatus,
} from "@/lib/validators/avenant";

const STATUS_VARIANTS: Record<
  AvenantStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  actif: "default",
  annule: "outline",
  brouillon: "outline",
  planifie: "secondary",
  applique: "default",
};

/** « Avenant n°2 » (numéro par circuit) ou « AV-014 » à défaut. */
function avenantLabel(circuitSequence: number | null, displayId: number) {
  return circuitSequence != null
    ? `Avenant n°${circuitSequence}`
    : `AV-${String(displayId).padStart(3, "0")}`;
}

type ChangeRow = {
  changeId: string;
  type: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  usagerCircuitId: string | null;
  avenantId: string;
  displayId: number;
  circuitSequence: number | null;
  circuitId: string | null;
  effectiveDate: string;
  endDate: string | null;
  reason: string;
  status: string;
  appliedAt: Date | null;
  createdAt: Date;
};

interface TabAvenantsProps {
  usagerId: string;
}

export function TabAvenants({ usagerId }: TabAvenantsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: rows, isLoading } = useQuery(
    trpc.avenants.listByUsager.queryOptions({ usagerId }),
  );

  const cancelMutation = useMutation(
    trpc.avenants.cancel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.avenants.listByUsager.queryKey({ usagerId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
        });
        toast.success("Avenant annulé");
      },
      onError: () => toast.error("Erreur lors de l'annulation"),
    }),
  );

  // Group change rows by avenant
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { header: ChangeRow; changes: ChangeRow[] }
    >();
    for (const r of (rows ?? []) as ChangeRow[]) {
      const g = map.get(r.avenantId);
      if (g) g.changes.push(r);
      else map.set(r.avenantId, { header: r, changes: [r] });
    }
    return Array.from(map.values());
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const newButton = (
    <Button
      onClick={() => router.push(`/avenants/new?usagerId=${usagerId}`)}
      size="sm"
      className="cursor-pointer"
    >
      <Plus className="mr-2 h-4 w-4" />
      Nouvel avenant
    </Button>
  );

  if (grouped.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avenants (0)
          </h3>
          {newButton}
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Aucun avenant
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les modifications tracées de cet usager apparaîtront ici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Avenants ({grouped.length})
        </h3>
        {newButton}
      </div>
      {grouped.map(({ header, changes }) => (
        <div
          key={header.avenantId}
          className="rounded-lg border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {avenantLabel(header.circuitSequence, header.displayId)}
                </span>
                <Badge
                  variant={
                    STATUS_VARIANTS[header.status as AvenantStatus] ?? "outline"
                  }
                  className="rounded-md"
                >
                  {AVENANT_STATUS_LABELS[header.status as AvenantStatus] ??
                    header.status}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {header.effectiveDate}
                  {header.endDate ? ` → ${header.endDate}` : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{header.reason}</p>
            </div>

            {header.status !== "annule" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Annuler
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Annuler l&apos;
                      {avenantLabel(
                        header.circuitSequence,
                        header.displayId,
                      ).toLowerCase()}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      L&apos;avenant sera retiré de l&apos;historique actif. La
                      réversion automatique des affectations n&apos;est pas
                      faite : pour revenir en arrière, créez un avenant inverse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Retour
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        cancelMutation.mutate({ id: header.avenantId })
                      }
                      disabled={cancelMutation.isPending}
                      className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Annuler l&apos;avenant
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
            {changes.map((c) => (
              <div key={c.changeId} className="flex flex-col gap-1.5">
                <Badge variant="outline" className="w-fit rounded-md text-xs">
                  {AVENANT_TYPE_LABELS[c.type as AvenantChangeType] ?? c.type}
                </Badge>
                <AvenantChangeDiff
                  type={c.type}
                  previous={c.previousValue}
                  next={c.newValue}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

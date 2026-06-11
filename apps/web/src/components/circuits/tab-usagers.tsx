"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ExternalLink } from "lucide-react";
import { UsersIcon } from "@/components/ui/users-icon";
import { DayBadges } from "@/components/shared/day-badges";
import type { DayEntry } from "@/lib/types/day-entry";

interface UsagerCircuitRow {
  id: string;
  usagerId: string;
  usagerAddressId: string | null;
  validFrom: string | null;
  transportStartDate: string | null;
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  usagerFirstName: string;
  usagerLastName: string;
  usagerCode: string | null;
  addressType: string | null;
  addressCity: string | null;
  addressAddress: string | null;
  avenantCount: number;
}

// "YYYY-MM-DD" → "DD/MM/YYYY".
function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface TabUsagersProps {
  circuitId: string;
}

/**
 * Circuit-centric view of assigned usagers, READ ONLY.
 * Association is done exclusively from the usager detail page; day/address
 * changes go through an avenant. Only dissociation is offered here.
 */
export function TabUsagers({ circuitId }: TabUsagersProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [deleteItem, setDeleteItem] = useState<UsagerCircuitRow | null>(null);

  // openOnly: show ALL usagers on the circuit (current + upcoming, e.g.
  // a usager starting later), not only those active today.
  const { data: linkedUsagers, isLoading } = useQuery(
    trpc.usagerCircuits.listByCircuit.queryOptions({ circuitId, openOnly: true }),
  );

  // As soon as a circuit has an avenant (beyond the base), direct dissociation
  // of all its usagers is blocked (consistent with the server guard).
  const { data: circuitAvenants } = useQuery(
    trpc.avenants.listByCircuit.queryOptions({ circuitId }),
  );
  const circuitLocked = (circuitAvenants?.length ?? 0) > 0;

  const deleteMutation = useMutation(
    trpc.usagerCircuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagerCircuits.listByCircuit.queryKey({ circuitId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listByCircuit.queryKey({ circuitId }),
        });
        // Refreshes usagerCount → unlocks dates as soon as there are no more
        // usagers (Informations tab), without waiting for a full reload.
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey({ id: circuitId }),
        });
        toast.success("Usager dissocié");
        setDeleteItem(null);
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la dissociation"),
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!linkedUsagers || linkedUsagers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-16">
        <UsersIcon size={48} className="text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          Aucun usager
        </h3>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
          L&apos;association d&apos;un usager se fait depuis sa fiche
          (&laquo;&nbsp;Associer un circuit&nbsp;&raquo;).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[0.3rem] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Début transport</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Prenom</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Jours aller</TableHead>
              <TableHead>Jours retour</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedUsagers.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => router.push(`/usagers/${item.usagerId}`)}
                className="group/row cursor-pointer transition-colors hover:bg-muted/50"
              >
                <TableCell className="whitespace-nowrap tabular-nums">
                  {/* Start on circuit: validFrom of the affectation (avenant
                      case), otherwise the usager's transport start date. */}
                  {item.validFrom ?? item.transportStartDate ? (
                    formatDate(item.validFrom ?? item.transportStartDate)
                  ) : (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.usagerCode ?? (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Link
                      href={`/usagers/${item.usagerId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer text-foreground transition-colors hover:text-primary"
                    >
                      {item.usagerLastName}
                    </Link>
                    <Link
                      href={`/usagers/${item.usagerId}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:!opacity-100 hover:text-primary group-hover/row:opacity-70"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </span>
                </TableCell>
                <TableCell>{item.usagerFirstName}</TableCell>
                <TableCell>
                  {item.addressType ? (
                    <span className="text-sm">
                      {item.addressType}
                      {item.addressCity && (
                        <span className="ml-1 text-muted-foreground">
                          ({item.addressCity})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <DayBadges days={item.daysAller} label="A" />
                </TableCell>
                <TableCell>
                  <DayBadges days={item.daysRetour} label="R" />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <span
                    className="inline-flex"
                    title={
                      circuitLocked
                        ? "Dissociation impossible : ce circuit a des avenants. Annulez-les d'abord."
                        : undefined
                    }
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive disabled:cursor-not-allowed"
                      onClick={() => setDeleteItem(item)}
                      disabled={circuitLocked}
                      aria-label="Dissocier l'usager"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dissocier l&apos;usager</AlertDialogTitle>
            <AlertDialogDescription>
              Retirer{" "}
              <strong>
                {deleteItem?.usagerFirstName} {deleteItem?.usagerLastName}
              </strong>{" "}
              de ce circuit ?
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
              onClick={() =>
                deleteItem && deleteMutation.mutate({ id: deleteItem.id })
              }
              disabled={deleteMutation.isPending}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Dissociation..." : "Dissocier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

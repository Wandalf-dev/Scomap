"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Bell, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import NextLink from "next/link";
import { ShareIcon } from "@/components/ui/share-icon";
import { DayMiniGrid } from "@/components/shared/day-mini-grid";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import {
  isCircuitCompatibleTransport,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import type { DayEntry } from "@/lib/types/day-entry";

// "YYYY-MM-DD" → "JJ/MM/AAAA" (cohérent avec l'affichage des trajets).
function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface UsagerCircuitRow {
  id: string;
  circuitId: string;
  usagerAddressId: string | null;
  validFrom: string | null;
  arrivalNotification: boolean;
  authorizationAlone: boolean;
  daysAller: DayEntry[];
  daysRetour: DayEntry[];
  circuitName: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  addressType: string | null;
  addressCity: string | null;
  addressAddress: string | null;
}

interface UsagerInfo {
  id: string;
  transportType: string | null;
  /** Date de début de transport (fiche usager) — début par défaut sur un circuit. */
  transportStartDate: string | null;
}

interface TabCircuitsProps {
  usagerId: string;
  usager: UsagerInfo;
}

export function TabCircuits({ usagerId, usager }: TabCircuitsProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteItem, setDeleteItem] = useState<UsagerCircuitRow | null>(null);

  const { data: linkedCircuits, isLoading } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );

  const { data: usagerAddresses } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );

  const deleteMutation = useMutation(
    trpc.usagerCircuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        // Dissocier change usagerCount du circuit → rafraîchit sa fiche pour
        // déverrouiller les dates (onglet Informations).
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey(),
        });
        toast.success("Circuit dissocié");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function getAddressLabel(type: string | null): string {
    if (!type) return "";
    return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
  }

  // Seul le transport "Taxi collectif / individuel" donne lieu à un circuit.
  const circuitEligible = isCircuitCompatibleTransport(usager.transportType);
  const transportTypeLabel = usager.transportType
    ? USAGER_TRANSPORT_TYPE_LABELS[
        usager.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
      ] ?? usager.transportType
    : null;

  // Une seule affectation par adresse : on ne peut associer que s'il reste une
  // adresse LIBRE (aucune adresse, ou toutes déjà sur un circuit → désactivé).
  const occupiedAddressIds = new Set(
    (linkedCircuits ?? [])
      .map((lc) => lc.usagerAddressId)
      .filter((id): id is string => !!id),
  );
  const hasAddresses = (usagerAddresses?.length ?? 0) > 0;
  const noFreeAddress =
    usagerAddresses !== undefined &&
    !usagerAddresses.some((a) => !occupiedAddressIds.has(a.id));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!circuitEligible && (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-foreground">
            Le type de transport de cet usager
            {transportTypeLabel && (
              <>
                {" "}
                (<strong>{transportTypeLabel}</strong>)
              </>
            )}{" "}
            ne nécessite pas de circuit. L&apos;affectation à un circuit est
            réservée au transport « Taxi collectif / individuel ».
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Circuits ({linkedCircuits?.length ?? 0})
        </h3>
        <Button
          onClick={() => router.push(`/usagers/${usagerId}/associer-circuit`)}
          disabled={!circuitEligible || noFreeAddress}
          size="sm"
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Associer un circuit
        </Button>
      </div>

      {circuitEligible && noFreeAddress && (
        <p className="text-xs text-muted-foreground">
          {hasAddresses ? (
            <>
              Toutes les adresses de cet usager ont déjà un circuit. Pour en
              changer,{" "}
              <NextLink
                href={`/avenants/new?usagerId=${usagerId}`}
                className="font-medium text-primary hover:underline"
              >
                créez un avenant
              </NextLink>
              .
            </>
          ) : (
            "Cet usager n'a aucune adresse. Ajoutez-en une avant de l'associer à un circuit."
          )}
        </p>
      )}

      {!linkedCircuits || linkedCircuits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShareIcon size={24} />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Aucun circuit
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Associez un circuit à cet usager pour définir ses jours de prise en
            charge.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <Table>
            <TableHeader className="[&_tr]:border-b [&_tr]:bg-muted/40">
              <TableRow>
                <TableHead>Circuit</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Début transport</TableHead>
                <TableHead>Jours aller</TableHead>
                <TableHead>Jours retour</TableHead>
                <TableHead>Options</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedCircuits.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5 group/link">
                      <NextLink
                        href={`/circuits/${item.circuitId}`}
                        className="text-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {item.circuitName}
                      </NextLink>
                      <NextLink
                        href={`/circuits/${item.circuitId}`}
                        target="_blank"
                        className="opacity-0 group-hover/link:opacity-70 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </NextLink>
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.etablissementName ? (
                      <span>
                        {item.etablissementName}
                        {item.etablissementCity && (
                          <span className="text-muted-foreground ml-1">
                            ({item.etablissementCity})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.addressType ? (
                      <span className="text-sm">
                        {getAddressLabel(item.addressType)}
                        {item.addressCity && (
                          <span className="text-muted-foreground ml-1">
                            ({item.addressCity})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {/* Début effectif sur ce circuit : validFrom de la version
                        si présent (cas avenant), sinon la date de début de
                        transport de la fiche usager. */}
                    {item.validFrom ?? usager.transportStartDate ? (
                      <span className="text-sm tabular-nums">
                        {formatDate(item.validFrom ?? usager.transportStartDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DayMiniGrid days={item.daysAller} color="orange" />
                  </TableCell>
                  <TableCell>
                    <DayMiniGrid days={item.daysRetour} color="blue" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {item.arrivalNotification && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Bell className="h-3 w-3" />
                          Notif
                        </Badge>
                      )}
                      {item.authorizationAlone && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Seul
                        </Badge>
                      )}
                      {!item.arrivalNotification && !item.authorizationAlone && (
                        <span className="text-muted-foreground/60">&mdash;</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/usagers/${usagerId}/associer-circuit?lien=${item.id}`,
                          )
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DissociateDialog
        deleteItem={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate({ id: deleteItem.id })}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// --- Dissociate Dialog ---

function DissociateDialog({
  deleteItem,
  onClose,
  onConfirm,
  isPending,
}: {
  deleteItem: UsagerCircuitRow | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const trpc = useTRPC();

  const { data: usagerCount } = useQuery({
    ...trpc.usagerCircuits.countByCircuit.queryOptions({
      circuitId: deleteItem?.circuitId ?? "",
    }),
    enabled: !!deleteItem,
  });

  const willBeEmpty = usagerCount !== undefined && usagerCount <= 1;

  return (
    <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dissocier le circuit</AlertDialogTitle>
          <AlertDialogDescription>
            Retirer l&apos;usager du circuit{" "}
            <strong>{deleteItem?.circuitName}</strong> ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {willBeEmpty && (
          <div className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm text-foreground">
              Cet usager est le dernier sur le circuit{" "}
              <strong>{deleteItem?.circuitName}</strong>. Le dissocier rendra le
              circuit inactif. Vous pourrez le retrouver dans la liste des
              circuits.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="cursor-pointer">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Suppression..." : "Dissocier"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

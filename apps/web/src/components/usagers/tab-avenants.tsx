"use client";

import { useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
import { FileText, X, Plus } from "lucide-react";
import {
  AvenantTable,
  type AvenantTableRow,
} from "@/components/avenants/avenant-table";

type ChangeRow = {
  changeId: string;
  type: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  usagerCircuitId: string | null;
  usagerId: string;
  usagerFirstName: string;
  usagerLastName: string;
  avenantId: string;
  displayId: number;
  circuitSequence: number | null;
  circuitId: string | null;
  circuitCode: string | null;
  circuitName: string | null;
  circuitStartDate: string | null;
  effectiveDate: string;
  endDate: string | null;
  reason: string;
  status: string;
  appliedAt: Date | null;
  createdAt: Date;
};

/** « Nom Prénom, … : motif » — façon objet d'avenant Transcolaire. */
function buildObjet(changes: ChangeRow[], reason: string): string {
  const names = [
    ...new Set(
      changes
        .map((c) => `${c.usagerLastName} ${c.usagerFirstName}`.trim())
        .filter(Boolean),
    ),
  ];
  return names.length > 0 ? `${names.join(", ")} : ${reason}` : reason;
}

function CancelAvenantButton({
  label,
  onConfirm,
  pending,
}: {
  label: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
          aria-label="Annuler l'avenant"
        >
          <X className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler l&apos;avenant n°{label}</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;avenant est retiré de l&apos;historique actif et son
            versioning de trajets annulé (les trajets recréés sont supprimés et
            les anciens rouverts).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            Retour
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Annuler l&apos;avenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
        // Tous les usagers (l'avenant peut être visible chez d'autres usagers du
        // même circuit) + vues circuit (versioning de trajets annulé).
        queryClient.invalidateQueries({
          queryKey: trpc.avenants.listByUsager.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.trajets.listByCircuit.queryKey(),
        });
        queryClient.invalidateQueries({ queryKey: trpc.arrets.list.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.avenants.listByCircuit.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey(),
        });
        toast.success("Avenant annulé");
      },
      onError: () => toast.error("Erreur lors de l'annulation"),
    }),
  );

  // Regroupe les lignes de changement par avenant.
  const grouped = useMemo(() => {
    const map = new Map<string, { header: ChangeRow; changes: ChangeRow[] }>();
    for (const r of (rows ?? []) as ChangeRow[]) {
      const g = map.get(r.avenantId);
      if (g) g.changes.push(r);
      else map.set(r.avenantId, { header: r, changes: [r] });
    }
    return Array.from(map.values());
  }, [rows]);

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const avenantRows: AvenantTableRow[] = grouped.map(({ header, changes }) => {
    // « Propre » = l'usager est sujet d'au moins un changement ; sinon avenant du
    // circuit (autre usager) → visible mais non annulable d'ici.
    const isOwn = changes.some((c) => c.usagerId === usagerId);
    const cancellable = isOwn && header.status !== "annule";
    // N° = ID de l'objet avenant (displayId).
    const numero = String(header.displayId);
    return {
      key: header.avenantId,
      circuitKey: header.circuitId ?? undefined,
      numero,
      isBase: false,
      fromCircuit: !isOwn,
      effectiveDate: header.effectiveDate,
      objet: buildObjet(changes, header.reason),
      code: header.circuitCode,
      circuitName: header.circuitName,
      // Depuis la fiche usager : le circuit est cliquable (≠ fiche circuit).
      circuitHref: header.circuitId ? `/circuits/${header.circuitId}` : null,
      href: header.circuitId
        ? `/circuits/${header.circuitId}/avenants/${header.avenantId}`
        : null,
      actions: cancellable ? (
        <CancelAvenantButton
          label={numero}
          pending={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate({ id: header.avenantId })}
        />
      ) : undefined,
    };
  });

  // Ligne N°0 (composition initiale) par circuit distinct présent dans les avenants.
  const circuitsSeen = new Map<
    string,
    { code: string | null; name: string | null; startDate: string | null }
  >();
  for (const { header } of grouped) {
    if (header.circuitId && !circuitsSeen.has(header.circuitId)) {
      circuitsSeen.set(header.circuitId, {
        code: header.circuitCode,
        name: header.circuitName,
        startDate: header.circuitStartDate,
      });
    }
  }
  const baseRows: AvenantTableRow[] = [...circuitsSeen.entries()].map(
    ([cid, c]) => ({
      key: `base-${cid}`,
      circuitKey: cid,
      numero: "0",
      isBase: true,
      effectiveDate: c.startDate ?? "",
      objet: "Composition initiale",
      code: c.code,
      circuitName: c.name,
      circuitHref: `/circuits/${cid}`,
      href: `/circuits/${cid}?tab=trajets`,
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Avenants ({avenantRows.length})
        </h3>
        {newButton}
      </div>

      {avenantRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Aucun avenant
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les avenants de cet usager et de ses circuits apparaîtront ici.
          </p>
        </div>
      ) : (
        <AvenantTable rows={[...avenantRows, ...baseRows]} />
      )}
    </div>
  );
}

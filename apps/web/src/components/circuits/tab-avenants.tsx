"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import {
  AvenantTable,
  type AvenantTableRow,
} from "@/components/avenants/avenant-table";
import {
  CancelAvenantButton,
  DeleteCompositionButton,
} from "@/components/avenants/avenant-row-actions";

interface TabAvenantsCircuitProps {
  circuitId: string;
}

type CircuitChange = {
  usagerFirstName: string;
  usagerLastName: string;
};

/** « Nom Prénom, … : motif » — façon objet d'avenant Transcolaire. */
function buildObjet(changes: CircuitChange[], reason: string): string {
  const names = [
    ...new Set(
      changes
        .map((c) => `${c.usagerLastName} ${c.usagerFirstName}`.trim())
        .filter(Boolean),
    ),
  ];
  return names.length > 0 ? `${names.join(", ")} : ${reason}` : reason;
}

export function TabAvenantsCircuit({ circuitId }: TabAvenantsCircuitProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: avenants, isLoading } = useQuery(
    trpc.avenants.listByCircuit.queryOptions({ circuitId }),
  );
  const { data: circuit } = useQuery(
    trpc.circuits.getById.queryOptions({ id: circuitId }),
  );

  // Invalidations communes aux deux actions (annulation d'avenant / suppression
  // de la composition) : avenants, affectations, trajets et arrêts du circuit.
  function invalidateAll() {
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByCircuit.queryKey({ circuitId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByUsager.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByCircuit.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByUsager.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listByCircuit.queryKey(),
    });
    queryClient.invalidateQueries({ queryKey: trpc.arrets.list.queryKey() });
    queryClient.invalidateQueries({
      queryKey: trpc.circuits.getById.queryKey({ id: circuitId }),
    });
  }

  const cancelMutation = useMutation(
    trpc.avenants.cancel.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        toast.success("Avenant annulé");
      },
      onError: () => toast.error("Erreur lors de l'annulation"),
    }),
  );

  const clearMutation = useMutation(
    trpc.usagerCircuits.clearComposition.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        toast.success("Composition initiale supprimée — usagers dissociés");
      },
      onError: (e) => toast.error(e.message || "Erreur lors de la suppression"),
    }),
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

  const avenantRows: AvenantTableRow[] = (avenants ?? []).map((a) => ({
    key: a.id,
    circuitKey: circuitId,
    // N° = ID de l'objet avenant (displayId), pas la séquence par circuit.
    numero: String(a.displayId),
    isBase: false,
    effectiveDate: a.effectiveDate,
    objet: buildObjet(a.changes, a.reason),
    code: circuit?.code ?? null,
    circuitName: circuit?.name ?? null,
    href: `/circuits/${circuitId}/avenants/${a.id}`,
    actions:
      a.status !== "annule" ? (
        <CancelAvenantButton
          label={String(a.displayId)}
          pending={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate({ id: a.id })}
        />
      ) : undefined,
  }));

  // Ligne N°0 = composition initiale du circuit (« avenant 0 » synthétique, non
  // stocké). Elle ne se justifie que si le circuit a des usagers : une fois la
  // composition supprimée (tous dissociés), la ligne disparaît. Sa suppression
  // reste interdite tant que des avenants réels s'appuient dessus.
  const hasUsagers = (circuit?.usagerCount ?? 0) > 0;
  const baseRow: AvenantTableRow | null = hasUsagers
    ? {
        key: "base",
        circuitKey: circuitId,
        numero: "0",
        isBase: true,
        effectiveDate: circuit?.startDate ?? "",
        objet: "Composition initiale",
        code: circuit?.code ?? null,
        circuitName: circuit?.name ?? null,
        href: `/circuits/${circuitId}?tab=trajets`,
        actions: (
          <DeleteCompositionButton
            pending={clearMutation.isPending}
            disabled={avenantRows.length > 0}
            onConfirm={() => clearMutation.mutate({ circuitId })}
          />
        ),
      }
    : null;

  const rows = baseRow ? [...avenantRows, baseRow] : avenantRows;

  // Ni avenant ni composition (ex. composition initiale supprimée → circuit vidé).
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="size-4" />
        Aucun avenant sur ce circuit — aucun usager n&apos;y est affecté.
      </div>
    );
  }

  // Seule la composition initiale (aucun avenant réel).
  if (avenantRows.length === 0) {
    return (
      <div className="space-y-4">
        <AvenantTable rows={rows} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" />
          Aucun avenant sur ce circuit pour l&apos;instant — seule la composition
          initiale est listée.
        </div>
      </div>
    );
  }

  return <AvenantTable rows={rows} />;
}

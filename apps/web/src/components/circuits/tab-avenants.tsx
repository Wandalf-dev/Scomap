"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import {
  AvenantTable,
  type AvenantTableRow,
} from "@/components/avenants/avenant-table";

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
  const { data: avenants, isLoading } = useQuery(
    trpc.avenants.listByCircuit.queryOptions({ circuitId }),
  );
  const { data: circuit } = useQuery(
    trpc.circuits.getById.queryOptions({ id: circuitId }),
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
  }));

  // Ligne N°0 = composition initiale du circuit (= « avenant 0 » synthétique,
  // non stocké). Affichée en dernier, comme dans Transcolaire.
  const baseRow: AvenantTableRow = {
    key: "base",
    circuitKey: circuitId,
    numero: "0",
    isBase: true,
    effectiveDate: circuit?.startDate ?? "",
    objet: "Composition initiale",
    code: circuit?.code ?? null,
    circuitName: circuit?.name ?? null,
    href: `/circuits/${circuitId}?tab=trajets`,
  };

  const rows = [...avenantRows, baseRow];

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

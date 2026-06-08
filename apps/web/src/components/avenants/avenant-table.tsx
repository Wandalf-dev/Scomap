"use client";

import type { ReactNode } from "react";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import { Share2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// "YYYY-MM-DD" → "JJ/MM/AAAA".
function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type Validity = "en_cours" | "a_venir" | "passe";

export interface AvenantTableRow {
  key: string;
  /** Regroupe les lignes par circuit pour le calcul « en cours » par timeline. */
  circuitKey?: string;
  /** ID de l'objet avenant (displayId) ; « 0 » pour la composition initiale. */
  numero: string;
  isBase: boolean;
  /** Avenant d'un autre usager du même circuit (vue usager). */
  fromCircuit?: boolean;
  effectiveDate: string;
  objet: string;
  code: string | null;
  circuitName: string | null;
  /** Si fourni, le nom du circuit devient un lien (utile depuis la fiche usager). */
  circuitHref?: string | null;
  /** Destination au clic sur la ligne. */
  href: string | null;
  /** Actions (ex. annuler), rendues en fin de ligne ; clic isolé de la ligne. */
  actions?: ReactNode;
}

function Dash() {
  return <span className="text-muted-foreground/50">&mdash;</span>;
}

function ValidityBadge({ validity }: { validity: Validity }) {
  if (validity === "en_cours") {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500">
        En cours
      </Badge>
    );
  }
  if (validity === "a_venir") {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
      >
        À venir
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      Passé
    </Badge>
  );
}

/**
 * Tableau d'avenants façon Transcolaire : une ligne par avenant + une ligne
 * « N°0 » (composition initiale). Statut résolu par date (en cours / à venir /
 * passé) — la ligne EN COURS est mise en avant. Lignes cliquables (→ détail).
 */
export function AvenantTable({ rows }: { rows: AvenantTableRow[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  // « En cours » par CIRCUIT (chaque circuit a sa propre timeline) : le dernier
  // AVENANT dont la date d'effet est passée gouverne ; si aucun n'a pris effet,
  // c'est la composition de base (N°0) qui est « en cours » (le plan courant).
  const groups = new Map<string, AvenantTableRow[]>();
  for (const r of rows) {
    const g = r.circuitKey ?? "_";
    const arr = groups.get(g);
    if (arr) arr.push(r);
    else groups.set(g, [r]);
  }
  const headKeyByGroup = new Map<string, string>();
  for (const [g, grp] of groups) {
    const pastAvenants = grp
      .filter((r) => !r.isBase && r.effectiveDate && r.effectiveDate <= today)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    const head =
      pastAvenants.length > 0
        ? pastAvenants[pastAvenants.length - 1]
        : grp.find((r) => r.isBase);
    if (head) headKeyByGroup.set(g, head.key);
  }

  const validityOf = (r: AvenantTableRow): Validity => {
    if (r.key === headKeyByGroup.get(r.circuitKey ?? "_")) return "en_cours";
    if (r.effectiveDate && r.effectiveDate > today) return "a_venir";
    return "passe";
  };

  return (
    <div className="overflow-x-auto rounded-[0.3rem] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">N&deg;</TableHead>
            <TableHead className="whitespace-nowrap">A partir du</TableHead>
            <TableHead className="w-[110px]">Statut</TableHead>
            <TableHead>Objet de l&apos;avenant</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Circuit</TableHead>
            <TableHead className="w-[52px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const validity = validityOf(row);
            const clickable = !!row.href;
            return (
              <TableRow
                key={row.key}
                onClick={
                  clickable ? () => router.push(row.href!) : undefined
                }
                className={cn(
                  "transition-colors",
                  clickable && "cursor-pointer",
                  validity === "en_cours"
                    ? "bg-primary/[0.07] hover:bg-primary/[0.11]"
                    : clickable && "hover:bg-muted/50",
                )}
              >
                <TableCell className="align-middle font-semibold tabular-nums text-foreground">
                  {row.numero}
                </TableCell>
                <TableCell className="whitespace-nowrap align-middle tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                  {formatDate(row.effectiveDate)}
                </TableCell>
                <TableCell className="align-middle">
                  <ValidityBadge validity={validity} />
                </TableCell>
                <TableCell className="align-middle">
                  <span className="flex items-center gap-2">
                    {row.fromCircuit && (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 rounded-md border-sky-300 text-[10px] text-sky-700 dark:border-sky-800 dark:text-sky-400"
                      >
                        <Share2 className="h-2.5 w-2.5" />
                        circuit
                      </Badge>
                    )}
                    <span
                      className={cn(
                        row.isBase && "text-muted-foreground",
                        !row.objet && "text-muted-foreground/60",
                      )}
                    >
                      {row.objet || "—"}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="align-middle font-medium">
                  {row.code ? row.code : <Dash />}
                </TableCell>
                <TableCell
                  className="max-w-[220px] align-middle"
                  title={row.circuitName ?? ""}
                >
                  {row.circuitName ? (
                    row.circuitHref ? (
                      <Link
                        href={row.circuitHref}
                        onClick={(e) => e.stopPropagation()}
                        className="block cursor-pointer truncate text-primary hover:underline"
                      >
                        {row.circuitName}
                      </Link>
                    ) : (
                      <span className="block truncate">{row.circuitName}</span>
                    )
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell
                  className="align-middle text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.actions}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

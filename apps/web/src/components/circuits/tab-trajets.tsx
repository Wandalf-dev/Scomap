"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { ArrowPathRoundedSquareIcon } from "@/components/ui/arrow-path-rounded-square-icon";
import { TrajetEtatBadge } from "@/components/shared/trajet-etat-badge";
import { TrajetMapDialog } from "@/components/trajets/trajet-map-dialog";
import { CircuitRecap } from "./circuit-recap";

interface TabTrajetsProps {
  circuitId: string;
  /**
   * Date de résolution (défaut : aujourd'hui). Fournie pour la vue « état du
   * circuit à la date d'un avenant » : validité des trajets + récap résolus à
   * cette date.
   */
  date?: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatKm(km: number | null | undefined): string {
  if (km == null) return "—";
  return km.toFixed(2).replace(".", ",");
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Dash() {
  return <span className="text-muted-foreground/50">&mdash;</span>;
}

/**
 * Validité temporelle d'un trajet, résolue par date (modèle daté des arrêts) :
 * - actif   → présent aujourd'hui (« En cours »)
 * - avenir  → démarre plus tard via un avenant (« Dès le JJ/MM »)
 * - termine → remplacé par un avenant, présence close (« Terminé le JJ/MM »)
 * À la date d'effet de l'avenant, l'ancien bascule en « terminé » et le nouveau
 * en « en cours » automatiquement (les compteurs sont relatifs à aujourd'hui).
 */
function TrajetValiditeBadge({
  validity,
}: {
  validity: { status: "actif" | "avenir" | "termine" | "vide"; date: string | null };
}) {
  if (validity.status === "actif") {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      >
        En cours
      </Badge>
    );
  }
  if (validity.status === "avenir") {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
      >
        Dès le {formatDate(validity.date)}
      </Badge>
    );
  }
  if (validity.status === "termine") {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-border text-muted-foreground"
      >
        Terminé le {formatDate(validity.date)}
      </Badge>
    );
  }
  return <Dash />;
}

export function TabTrajets({ circuitId, date }: TabTrajetsProps) {
  const trpc = useTRPC();
  const router = useRouter();

  const { data: trajets, isLoading } = useQuery(
    trpc.trajets.listByCircuit.queryOptions({ circuitId, date }),
  );

  // Retour contextuel : depuis un trajet ouvert ici, le bouton « Retour »
  // ramène sur l'onglet Trajets de ce circuit (et non la liste globale).
  const backParam = encodeURIComponent(`/circuits/${circuitId}?tab=trajets`);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!trajets || trajets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-16">
        <ArrowPathRoundedSquareIcon size={48} className="text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          Aucun trajet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Les trajets de ce circuit apparaitront ici.
        </p>
      </div>
    );
  }

  // Vue ICI = uniquement les trajets EN COURS + le PROCHAIN avenant à venir
  // (le groupe « à venir » dont la date est la plus proche). On masque les
  // trajets terminés et les trajets d'avenants ultérieurs (au-delà du prochain).
  const avenirDates = trajets
    .filter((t) => t.validity.status === "avenir" && t.validity.date)
    .map((t) => t.validity.date as string);
  const nextAvenirDate = avenirDates.length
    ? avenirDates.reduce((a, b) => (a < b ? a : b))
    : null;
  const visibleTrajets = trajets.filter((t) => {
    if (t.validity.status === "termine") return false;
    if (t.validity.status === "avenir") return t.validity.date === nextAvenirDate;
    return true; // actif / vide = trajets courants
  });
  const hiddenCount = trajets.length - visibleTrajets.length;

  return (
    <div className="space-y-6">
      {visibleTrajets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucun trajet en cours ni à venir
          </p>
          {hiddenCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {hiddenCount} trajet{hiddenCount > 1 ? "s" : ""} terminé
              {hiddenCount > 1 ? "s" : ""} (historique).
            </p>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-[0.3rem] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[56px]">N&deg;</TableHead>
              <TableHead className="whitespace-nowrap">A partir du</TableHead>
              <TableHead>Validit&eacute;</TableHead>
              <TableHead>Intitul&eacute;</TableHead>
              <TableHead>Sens</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead className="text-right">Temps</TableHead>
              <TableHead className="text-center">Usagers</TableHead>
              <TableHead className="text-center">Ets</TableHead>
              <TableHead>Avenant</TableHead>
              <TableHead>&Eacute;tat</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Circuit</TableHead>
              <TableHead>Observation</TableHead>
              <TableHead>Rotation</TableHead>
              <TableHead className="text-center">Carte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTrajets.map((trajet) => {
              // « A partir du » = date d'effet de l'avenant créateur, sinon
              // date propre du trajet, sinon date de début du circuit.
              const aPartirDu =
                trajet.avenantEffectiveDate ??
                trajet.startDate ??
                trajet.circuitStartDate;
              return (
                <TableRow
                  key={trajet.id}
                  onClick={() =>
                    router.push(`/trajets/${trajet.id}?back=${backParam}`)
                  }
                  className={cn(
                    "group/row cursor-pointer transition-colors hover:bg-muted/50",
                    trajet.validity.status === "termine" ? "opacity-55" : "",
                  )}
                >
                  <TableCell className="tabular-nums text-muted-foreground">
                    {trajet.displayId}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatDate(aPartirDu)}
                  </TableCell>
                  <TableCell>
                    <TrajetValiditeBadge validity={trajet.validity} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/trajets/${trajet.id}?back=${backParam}`}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer whitespace-nowrap text-foreground transition-colors hover:text-primary"
                      >
                        {trajet.name}
                      </Link>
                      <Link
                        href={`/trajets/${trajet.id}`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:!opacity-100 hover:text-primary group-hover/row:opacity-70"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        trajet.direction === "aller" ? "default" : "secondary"
                      }
                    >
                      {trajet.direction === "aller" ? "Aller" : "Retour"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKm(trajet.totalDistanceKm)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(trajet.totalDurationSeconds)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {/* Composition du trajet (tous ses usagers), pas seulement
                        ceux actifs aujourd'hui — sinon un trajet à venir = 0. */}
                    {trajet.totalUsager}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {trajet.etablissementCount}
                  </TableCell>
                  <TableCell>
                    {trajet.avenantDisplayId != null ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                      >
                        N&deg;{trajet.avenantDisplayId}
                      </Badge>
                    ) : (
                      // Trajet de la composition initiale (créé hors avenant).
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground"
                      >
                        Base
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <TrajetEtatBadge
                      etat={trajet.etat}
                      hasKm={trajet.totalDistanceKm != null}
                      hasTimes={
                        trajet.arretsActive > 0 && trajet.arretsUntimed === 0
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {trajet.circuitCode ? trajet.circuitCode : <Dash />}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={trajet.circuitName ?? ""}>
                    {trajet.circuitName ?? <Dash />}
                  </TableCell>
                  <TableCell
                    className="max-w-[180px] truncate text-muted-foreground"
                    title={trajet.notes ?? ""}
                  >
                    {trajet.notes ? trajet.notes : <Dash />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Dash />
                  </TableCell>
                  <TableCell className="text-center">
                    <TrajetMapDialog
                      trajetId={trajet.id}
                      trajetName={trajet.name}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      {visibleTrajets.length > 0 && hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenCount} trajet{hiddenCount > 1 ? "s" : ""} masqué
          {hiddenCount > 1 ? "s" : ""} (terminés ou avenants ultérieurs).
        </p>
      )}

      <CircuitRecap circuitId={circuitId} date={date} />
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
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
import { DayBadges } from "@/components/shared/day-badges";
import type { DayEntry } from "@/lib/types/day-entry";

interface TabTrajetsProps {
  circuitId: string;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function ValidityBadge({
  validity,
}: {
  validity: { status: "actif" | "avenir" | "termine" | "vide"; date: string | null };
}) {
  if (validity.status === "actif") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      >
        Actif
      </Badge>
    );
  }
  if (validity.status === "avenir") {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
      >
        Dès le {formatDate(validity.date)}
      </Badge>
    );
  }
  if (validity.status === "termine") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Terminé le {formatDate(validity.date)}
      </Badge>
    );
  }
  return <span className="text-muted-foreground/60">&mdash;</span>;
}

export function TabTrajets({ circuitId }: TabTrajetsProps) {
  const trpc = useTRPC();

  const { data: trajets, isLoading } = useQuery(
    trpc.trajets.listByCircuit.queryOptions({ circuitId }),
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

  return (
    <div className="rounded-[0.3rem] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Validité</TableHead>
            <TableHead>Etat</TableHead>
            <TableHead>Chauffeur</TableHead>
            <TableHead>Vehicule</TableHead>
            <TableHead>Depart</TableHead>
            <TableHead>Jours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trajets.map((trajet) => {
            const recurrence = trajet.recurrence as {
              frequency: string;
              daysOfWeek: DayEntry[];
            } | null;
            return (
              <TableRow
                key={trajet.id}
                className={
                  trajet.validity.status === "termine" ? "opacity-55" : ""
                }
              >
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5 group/link">
                    <Link
                      href={`/trajets/${trajet.id}`}
                      className="text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {trajet.name}
                    </Link>
                    <Link
                      href={`/trajets/${trajet.id}`}
                      target="_blank"
                      className="opacity-0 group-hover/link:opacity-70 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-primary"
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
                <TableCell>
                  <ValidityBadge validity={trajet.validity} />
                </TableCell>
                <TableCell>
                  {!trajet.etat || trajet.etat === "brouillon" ? (
                    <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
                      Brouillon
                    </Badge>
                  ) : trajet.etat === "ok" ? (
                    <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                      Ok
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                      Anomalie
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {trajet.chauffeurFirstName ? (
                    `${trajet.chauffeurFirstName} ${trajet.chauffeurLastName ?? ""}`
                  ) : (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  {trajet.vehiculeName ?? (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  {trajet.departureTime ?? (
                    <span className="text-muted-foreground/60">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <DayBadges days={recurrence?.daysOfWeek ?? null} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

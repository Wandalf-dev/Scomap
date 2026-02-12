"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
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
import { ArrowRightLeft } from "lucide-react";
import { DayBadges } from "@/components/shared/day-badges";
import type { DayEntry } from "@/lib/types/day-entry";

interface TabTrajetsProps {
  circuitId: string;
}

export function TabTrajets({ circuitId }: TabTrajetsProps) {
  const trpc = useTRPC();
  const router = useRouter();

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
      <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
        <ArrowRightLeft className="h-12 w-12 text-muted-foreground" />
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
    <div className="rounded-[0.3rem] border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Direction</TableHead>
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
                className="cursor-pointer"
                onClick={() => router.push(`/trajets/${trajet.id}`)}
              >
                <TableCell className="font-medium">{trajet.name}</TableCell>
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

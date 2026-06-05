"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CalendarClock, User } from "lucide-react";
import { AvenantChangeDiff } from "@/components/shared/avenant-change-diff";
import {
  AVENANT_TYPE_LABELS,
  type AvenantChangeType,
} from "@/lib/validators/avenant";
import {
  AvenantStatusBadge,
  avenantTodayStr,
  formatAvenantDate,
  getHeadAvenantId,
} from "@/components/shared/avenant-status-badge";

interface TabAvenantsCircuitProps {
  circuitId: string;
}

export function TabAvenantsCircuit({ circuitId }: TabAvenantsCircuitProps) {
  const trpc = useTRPC();
  const { data: avenants, isLoading } = useQuery(
    trpc.avenants.listByCircuit.queryOptions({ circuitId }),
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!avenants || avenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 py-16">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          Aucun avenant
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Les avenants portant sur ce circuit apparaîtront ici.
        </p>
      </div>
    );
  }

  const today = avenantTodayStr();
  const headId = getHeadAvenantId(
    avenants.map((a) => ({
      id: a.id,
      status: a.status,
      effectiveDate: a.effectiveDate,
      circuitSequence: a.circuitSequence,
    })),
    today,
  );

  return (
    <div className="space-y-3">
      {avenants.map((a) => (
        <div
          key={a.id}
          className="rounded-[0.3rem] border border-border bg-card p-4"
        >
          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {a.circuitSequence != null
                ? `Avenant n°${a.circuitSequence}`
                : `AV-${String(a.displayId).padStart(3, "0")}`}
            </span>
            <AvenantStatusBadge
              id={a.id}
              status={a.status}
              effectiveDate={a.effectiveDate}
              headId={headId}
              today={today}
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatAvenantDate(a.effectiveDate)}
              {a.endDate ? ` → ${formatAvenantDate(a.endDate)}` : ""}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {a.changes.length} usager{a.changes.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{a.reason}</p>

          {/* Détail par usager */}
          <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
            {a.changes.map((c) => (
              <div key={c.changeId} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/usagers/${c.usagerId}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <User className="h-3.5 w-3.5" />
                    {c.usagerLastName} {c.usagerFirstName}
                  </Link>
                  <Badge
                    variant="outline"
                    className="rounded-[0.3rem] text-xs"
                  >
                    {AVENANT_TYPE_LABELS[c.type as AvenantChangeType] ?? c.type}
                  </Badge>
                </div>
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

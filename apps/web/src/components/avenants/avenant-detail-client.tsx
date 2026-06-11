"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarClock, User, CalendarRange } from "lucide-react";
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
import { TabTrajets } from "@/components/circuits/tab-trajets";

interface AvenantDetailClientProps {
  circuitId: string;
  avenantId: string;
}

export function AvenantDetailClient({
  circuitId,
  avenantId,
}: AvenantDetailClientProps) {
  const trpc = useTRPC();
  const router = useRouter();

  // Reuse listByCircuit (already used by the Avenants tab): it carries
  // changes WITH usager names, unlike getById.
  const { data: avenants, isLoading } = useQuery(
    trpc.avenants.listByCircuit.queryOptions({ circuitId }),
  );
  const { data: circuit } = useQuery(
    trpc.circuits.getById.queryOptions({ id: circuitId }),
  );

  const backHref = `/circuits/${circuitId}?tab=avenants`;
  const avenant = avenants?.find((a) => a.id === avenantId) ?? null;

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!avenant) {
    return (
      <div className="w-full space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(backHref)}
          className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour au circuit
        </Button>
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Avenant introuvable.
        </div>
      </div>
    );
  }

  const today = avenantTodayStr();
  const headId = getHeadAvenantId(
    (avenants ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      effectiveDate: a.effectiveDate,
      circuitSequence: a.circuitSequence,
    })),
    today,
  );

  const title =
    avenant.circuitSequence != null
      ? `Avenant n°${avenant.circuitSequence}`
      : `AV-${String(avenant.displayId).padStart(3, "0")}`;

  return (
    <div className="w-full">
      {/* Sticky header (circuit detail page style). */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(backHref)}
            className="-ml-2 shrink-0 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Button>
          <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
            {circuit?.name ? (
              <span className="text-muted-foreground"> · {circuit.name}</span>
            ) : null}
          </h1>
          <AvenantStatusBadge
            id={avenant.id}
            status={avenant.status}
            effectiveDate={avenant.effectiveDate}
            headId={headId}
            today={today}
          />
        </div>
      </div>

      {/* Avenant summary (effective date, reason, changes per usager). */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Date d&apos;effet :{" "}
            <strong className="text-foreground">
              {formatAvenantDate(avenant.effectiveDate)}
            </strong>
            {avenant.endDate
              ? ` → ${formatAvenantDate(avenant.endDate)}`
              : ""}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {avenant.changes.length} usager
            {avenant.changes.length > 1 ? "s" : ""}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{avenant.reason}</p>
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {avenant.changes.map((c) => (
            <div key={c.changeId} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/usagers/${c.usagerId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <User className="h-3.5 w-3.5" />
                  {c.usagerLastName} {c.usagerFirstName}
                </Link>
                <Badge variant="outline" className="rounded-[0.3rem] text-xs">
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

      {/* Banner: switches to "circuit state at avenant date" view. */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-2.5 text-sm">
        <CalendarRange className="size-4 shrink-0 text-primary" />
        <span className="text-foreground">
          État du circuit au{" "}
          <strong>{formatAvenantDate(avenant.effectiveDate)}</strong> — tel
          qu&apos;établi par cet avenant
        </span>
      </div>

      {/* Trajets + PEC recap, resolved at the effective date. */}
      <TabTrajets circuitId={circuitId} date={avenant.effectiveDate} />
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DayChecksTable } from "@/components/shared/day-checks-table";
import { areDayEntriesEqual } from "@/lib/types/day-entry";
import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import {
  School,
  User,
  Clock,
  Bell,
  ShieldCheck,
  Check,
  ExternalLink,
} from "lucide-react";

interface CircuitRecapProps {
  circuitId: string;
  /** Resolution date (default: today). Freezes state to the date of an avenant. */
  date?: string;
}

function formatKm(km: number | null | undefined): string {
  if (km == null) return "—";
  return km.toFixed(1).replace(".", ",");
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getAddressTypeLabel(type: string | null): string {
  if (!type) return "";
  return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
}

function TimeChip({
  time,
  direction,
}: {
  time: string | null | undefined;
  direction: "aller" | "retour";
}) {
  if (!time) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border dark:border-foreground/30 bg-card px-2.5 py-1.5 text-sm font-bold tabular-nums text-foreground shadow-sm">
      <Clock
        className={cn(
          "size-3.5",
          direction === "aller"
            ? "text-primary"
            : "text-indigo-500 dark:text-indigo-400",
        )}
      />
      {time}
    </span>
  );
}

/** Transcolaire-style aller/retour column header: direction label, then the
 *  N° (green link to the trajet) and the title (days). No arrow. */
function DirectionHeaderCell({
  trajet,
  direction,
  backParam,
}: {
  trajet: { id: string; displayId: number | null; name: string } | null;
  direction: "aller" | "retour";
  backParam: string;
}) {
  const label = direction === "aller" ? "Aller" : "Retour";

  if (!trajet) {
    return (
      <span className="font-bold uppercase tracking-wide text-foreground">
        {label}
      </span>
    );
  }

  // Direction is already shown as label: strip the name prefix.
  const daysLabel = trajet.name.replace(/^(Aller|Retour)\s+/i, "");

  return (
    <div className="mx-auto flex max-w-[150px] flex-col items-center gap-0.5">
      <span className="font-bold uppercase tracking-wide text-foreground">
        {label}
      </span>
      <Link
        href={`/trajets/${trajet.id}?back=${backParam}`}
        className="inline-flex items-center gap-1 font-bold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        {trajet.displayId != null ? `N°${trajet.displayId}` : label}
        <ExternalLink className="size-3" />
      </Link>
      {daysLabel && (
        <span className="font-medium normal-case text-muted-foreground">
          {daysLabel}
        </span>
      )}
    </div>
  );
}

export function CircuitRecap({ circuitId, date }: CircuitRecapProps) {
  const trpc = useTRPC();

  const { data: trajets } = useQuery(
    trpc.trajets.listByCircuit.queryOptions({ circuitId, date }),
  );
  const { data: usagers } = useQuery(
    trpc.usagerCircuits.listByCircuit.queryOptions({ circuitId, date }),
  );

  // Representative trajet per direction: active first, otherwise the first one.
  const allerTrajet = useMemo(() => {
    const list = (trajets ?? []).filter((t) => t.direction === "aller");
    return list.find((t) => t.validity.status === "actif") ?? list[0] ?? null;
  }, [trajets]);
  const retourTrajet = useMemo(() => {
    const list = (trajets ?? []).filter((t) => t.direction === "retour");
    return list.find((t) => t.validity.status === "actif") ?? list[0] ?? null;
  }, [trajets]);

  const { data: allerArrets } = useQuery({
    ...trpc.arrets.list.queryOptions({ trajetId: allerTrajet?.id ?? "" }),
    enabled: !!allerTrajet,
  });
  const { data: retourArrets } = useQuery({
    ...trpc.arrets.list.queryOptions({ trajetId: retourTrajet?.id ?? "" }),
    enabled: !!retourTrajet,
  });

  const allerTimeByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allerArrets ?? []) {
      if (a.type === "usager" && a.usagerAddressId && a.arrivalTime) {
        m.set(a.usagerAddressId, a.arrivalTime);
      }
    }
    return m;
  }, [allerArrets]);
  const retourTimeByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of retourArrets ?? []) {
      if (a.type === "usager" && a.usagerAddressId && a.arrivalTime) {
        m.set(a.usagerAddressId, a.arrivalTime);
      }
    }
    return m;
  }, [retourArrets]);

  // Pickup order: follow the actual arrêt order on the aller (otherwise
  // retour), to list usagers in tour order — the school (destination)
  // is rendered at the end of the table.
  const pickupOrderByAddr = useMemo(() => {
    const source =
      allerArrets && allerArrets.length > 0 ? allerArrets : (retourArrets ?? []);
    const m = new Map<string, number>();
    for (const a of source) {
      if (a.type === "usager" && a.usagerAddressId) {
        m.set(a.usagerAddressId, a.orderIndex);
      }
    }
    return m;
  }, [allerArrets, retourArrets]);

  const sortedUsagers = useMemo(() => {
    const list = [...(usagers ?? [])];
    list.sort((a, b) => {
      const oa = a.usagerAddressId
        ? pickupOrderByAddr.get(a.usagerAddressId)
        : undefined;
      const ob = b.usagerAddressId
        ? pickupOrderByAddr.get(b.usagerAddressId)
        : undefined;
      if (oa == null && ob == null) return 0;
      if (oa == null) return 1; // unknown arrêt → end of list
      if (ob == null) return -1;
      return oa - ob;
    });
    return list;
  }, [usagers, pickupOrderByAddr]);

  const allerEtab = (allerArrets ?? []).find((a) => a.type === "etablissement");
  const retourEtab = (retourArrets ?? []).find(
    (a) => a.type === "etablissement",
  );
  const etabName =
    allerEtab?.etablissementName ??
    allerEtab?.name ??
    retourEtab?.etablissementName ??
    retourEtab?.name ??
    "Établissement";
  const etabAddress =
    [
      allerEtab?.address ?? retourEtab?.address,
      allerEtab?.etablissementCity ?? retourEtab?.etablissementCity,
    ]
      .filter(Boolean)
      .join(" — ") || null;
  const etabId = allerEtab?.etablissementId ?? retourEtab?.etablissementId ?? null;

  if (trajets === undefined || usagers === undefined) {
    return <Skeleton className="h-64 w-full rounded-[0.3rem]" />;
  }

  if (!allerTrajet && !retourTrajet) return null;

  const hasKm =
    allerTrajet?.totalDistanceKm != null ||
    retourTrajet?.totalDistanceKm != null;
  const totalKm =
    (allerTrajet?.totalDistanceKm ?? 0) + (retourTrajet?.totalDistanceKm ?? 0);
  const hasDuration =
    allerTrajet?.totalDurationSeconds != null ||
    retourTrajet?.totalDurationSeconds != null;
  const totalDurationSeconds =
    (allerTrajet?.totalDurationSeconds ?? 0) +
    (retourTrajet?.totalDurationSeconds ?? 0);
  // Contextual back: from a trajet opened via the recap, return to
  // the Trajets tab of this circuit (not the global trajet list).
  const backParam = encodeURIComponent(`/circuits/${circuitId}?tab=trajets`);

  return (
    <div className="overflow-hidden rounded-[0.3rem] border border-border dark:border-foreground/30 bg-card shadow-xs">
      {/* Header + display options */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-foreground/30 bg-gradient-to-r from-primary/[0.08] to-transparent px-4 py-2.5">
        <h3 className="text-[15px] font-bold tracking-tight text-foreground">
          Récapitulatif des prises en charge
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground">
              <Check className="size-3" strokeWidth={3} />
            </span>
            Pris en charge
          </span>
          <span>
            <strong className="font-bold text-foreground">P/I</strong> = sem.
            paires/impaires
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-border dark:border-foreground/30 bg-muted text-[11px] font-bold uppercase tracking-wide text-foreground">
              <th className="w-full px-4 py-2.5 text-left">Arrêt / Usager</th>
              <th className="w-[150px] border-l border-border dark:border-foreground/30 px-3 py-2.5 text-center">
                <DirectionHeaderCell
                  trajet={allerTrajet}
                  direction="aller"
                  backParam={backParam}
                />
              </th>
              <th className="w-[150px] border-l border-border dark:border-foreground/30 px-3 py-2.5 text-center">
                <DirectionHeaderCell
                  trajet={retourTrajet}
                  direction="retour"
                  backParam={backParam}
                />
              </th>
              <th className="border-l border-border dark:border-foreground/30 px-4 py-2.5 text-right">
                Jours de PEC
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Usagers first (pickup order) — établissement at the end */}
            {sortedUsagers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucun usager sur ce circuit.
                </td>
              </tr>
            ) : (
              sortedUsagers.map((u, i) => {
                const responsible = [
                  u.addressCivility,
                  u.responsibleFirstName,
                  u.responsibleLastName,
                ]
                  .filter(Boolean)
                  .join(" ");
                const phone = u.addressMobile || u.addressPhone || null;
                const typeLabel = getAddressTypeLabel(u.addressType);
                const addr = [u.addressAddress, u.addressCity]
                  .filter(Boolean)
                  .join(", ");
                const allerTime = u.usagerAddressId
                  ? (allerTimeByAddr.get(u.usagerAddressId) ?? null)
                  : null;
                const retourTime = u.usagerAddressId
                  ? (retourTimeByAddr.get(u.usagerAddressId) ?? null)
                  : null;
                const hasAllerDays = u.daysAller.length > 0;
                const hasRetourDays = u.daysRetour.length > 0;
                // Single table if aller days = retour days (common case);
                // two (Aller / Retour) only if they actually differ.
                const sameDays =
                  hasAllerDays &&
                  hasRetourDays &&
                  areDayEntriesEqual(u.daysAller, u.daysRetour);
                return (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-border dark:border-foreground/30 align-middle",
                      i % 2 === 1 && "bg-muted/20",
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <User className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">
                            <span className="group/usr inline-flex items-center gap-1.5 align-middle">
                              <Link
                                href={`/usagers/${u.usagerId}`}
                                className="transition-colors hover:text-primary"
                              >
                                {u.usagerLastName} {u.usagerFirstName}
                              </Link>
                              <Link
                                href={`/usagers/${u.usagerId}`}
                                target="_blank"
                                className="text-muted-foreground opacity-0 transition-opacity hover:!opacity-100 hover:text-primary group-hover/usr:opacity-70"
                              >
                                <ExternalLink className="size-3.5" />
                              </Link>
                            </span>
                            {u.usagerCode && (
                              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                n°{u.usagerCode}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel && (
                              <span className="font-semibold text-foreground/75">
                                {typeLabel}
                              </span>
                            )}
                            {typeLabel && addr ? " · " : ""}
                            {addr}
                          </p>
                          {(responsible || phone) && (
                            <p className="text-xs text-muted-foreground">
                              {responsible}
                              {responsible && phone ? " · " : ""}
                              {phone}
                            </p>
                          )}
                          {(u.arrivalNotification || u.authorizationAlone) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                              {u.arrivalNotification && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                                  <Bell className="size-3" />
                                  Notif
                                </span>
                              )}
                              {u.authorizationAlone && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                                  <ShieldCheck className="size-3" />
                                  Seul
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-l border-border dark:border-foreground/30 px-3 py-3 text-center align-middle">
                      <TimeChip time={allerTime} direction="aller" />
                    </td>
                    <td className="border-l border-border dark:border-foreground/30 px-3 py-3 text-center align-middle">
                      <TimeChip time={retourTime} direction="retour" />
                    </td>
                    <td className="border-l border-border dark:border-foreground/30 px-4 py-3 align-top">
                      {!hasAllerDays && !hasRetourDays ? (
                        <div className="text-right text-sm text-muted-foreground/50">
                          —
                        </div>
                      ) : sameDays ? (
                        <div className="flex justify-end">
                          <DayChecksTable days={u.daysAller} />
                        </div>
                      ) : (
                        <div className="flex items-start justify-end gap-5">
                          {hasAllerDays && (
                            <div className="text-center">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Aller
                              </div>
                              <DayChecksTable days={u.daysAller} />
                            </div>
                          )}
                          {hasRetourDays && (
                            <div className="text-center">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Retour
                              </div>
                              <DayChecksTable days={u.daysRetour} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Établissement (destination) — end of route on the aller */}
            <tr className="bg-primary/[0.06]">
              <td className="border-l-[3px] border-l-primary px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                    <School className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {etabId ? (
                        <span className="group/etab inline-flex items-center gap-1.5 align-middle">
                          <Link
                            href={`/etablissements/${etabId}`}
                            className="transition-colors hover:text-primary"
                          >
                            {etabName}
                          </Link>
                          <Link
                            href={`/etablissements/${etabId}`}
                            target="_blank"
                            className="text-muted-foreground opacity-0 transition-opacity hover:!opacity-100 hover:text-primary group-hover/etab:opacity-70"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </span>
                      ) : (
                        etabName
                      )}
                      <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        destination
                      </span>
                    </p>
                    {etabAddress && (
                      <p className="text-xs text-muted-foreground">
                        {etabAddress}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-3 text-center">
                <TimeChip time={allerEtab?.arrivalTime} direction="aller" />
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-3 text-center">
                <TimeChip time={retourEtab?.arrivalTime} direction="retour" />
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-4 py-3" />
            </tr>
          </tbody>

          {/* Totals */}
          <tfoot className="border-t-2 border-border dark:border-foreground/30 bg-muted/50 text-sm">
            <tr className="border-b border-border dark:border-foreground/30">
              <td className="px-4 py-2 text-right font-medium text-muted-foreground">
                Kilomètre en charge
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {formatKm(allerTrajet?.totalDistanceKm)}
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {formatKm(retourTrajet?.totalDistanceKm)}
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-4 py-2 text-right">
                {hasKm && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Total km en charge :{" "}
                    <span className="font-bold text-foreground">
                      {formatKm(totalKm)}
                    </span>
                  </span>
                )}
              </td>
            </tr>
            <tr className="border-b border-border dark:border-foreground/30">
              <td className="px-4 py-2 text-right font-medium text-muted-foreground">
                Temps en charge
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {formatDuration(allerTrajet?.totalDurationSeconds)}
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {formatDuration(retourTrajet?.totalDurationSeconds)}
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-4 py-2 text-right">
                {hasDuration && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Total temps en charge :{" "}
                    <span className="font-bold text-foreground">
                      {formatDuration(totalDurationSeconds)}
                    </span>
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-right font-medium text-muted-foreground">
                Usagers transportés
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {allerTrajet?.activeCount ?? 0}
              </td>
              <td className="border-l border-border dark:border-foreground/30 px-3 py-2 text-center font-bold tabular-nums">
                {retourTrajet?.activeCount ?? 0}
              </td>
              <td className="border-l border-border dark:border-foreground/30" />
            </tr>
          </tfoot>
        </table>
      </div>

      {!hasKm && (
        <div className="border-t border-border dark:border-foreground/30 bg-amber-500/[0.08] px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          Itinéraire non finalisé — distances et horaires de prise en charge non
          encore calculés pour ce circuit.
        </div>
      )}

      <div className="border-t border-border dark:border-foreground/30 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        Horaires donnés à titre indicatif · susceptibles de légères variations.
      </div>
    </div>
  );
}

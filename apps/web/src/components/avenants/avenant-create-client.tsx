"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DaySelector } from "@/components/shared/day-selector";
import { ArrowLeft, Route, CalendarDays, MapPin, School, Bus } from "lucide-react";
import {
  AVENANT_TYPE_LABELS,
  type AvenantChangeType,
  type AvenantChangeInput,
} from "@/lib/validators/avenant";
import {
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
  isCircuitCompatibleTransport,
} from "@/lib/validators/usager";
import { normalizeDays, type DayEntry } from "@/lib/types/day-entry";

const TYPES: { value: AvenantChangeType; icon: typeof Route }[] = [
  { value: "circuit", icon: Route },
  { value: "jours_pec", icon: CalendarDays },
  { value: "adresse", icon: MapPin },
  { value: "type_transport", icon: Bus },
  { value: "etablissement", icon: School },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

interface AvenantCreateClientProps {
  usagerId: string | null;
}

export function AvenantCreateClient({ usagerId }: AvenantCreateClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: usager, isLoading: usagerLoading } = useQuery({
    ...trpc.usagers.getById.queryOptions({ id: usagerId ?? "" }),
    enabled: !!usagerId,
  });
  const { data: affectations } = useQuery({
    ...trpc.usagerCircuits.listByUsager.queryOptions({ usagerId: usagerId ?? "" }),
    enabled: !!usagerId,
  });
  const { data: circuits } = useQuery(trpc.circuits.list.queryOptions());
  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );
  const { data: addresses } = useQuery({
    ...trpc.usagerAddresses.list.queryOptions({ usagerId: usagerId ?? "" }),
    enabled: !!usagerId,
  });

  const [usagerCircuitId, setUsagerCircuitId] = useState("");
  const [type, setType] = useState<AvenantChangeType>("circuit");
  const [newCircuitId, setNewCircuitId] = useState("");
  const [newAddressId, setNewAddressId] = useState("");
  const [newEtablissementId, setNewEtablissementId] = useState("");
  const [newTransportType, setNewTransportType] = useState("");
  const [daysAller, setDaysAller] = useState<DayEntry[]>([]);
  const [daysRetour, setDaysRetour] = useState<DayEntry[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayStr());
  const [reason, setReason] = useState("");

  const selectedAffectation = useMemo(
    () => affectations?.find((a) => a.id === usagerCircuitId),
    [affectations, usagerCircuitId],
  );

  // Preselect first affectation once loaded
  useEffect(() => {
    if (!usagerCircuitId && affectations && affectations.length > 0) {
      setUsagerCircuitId(affectations[0]!.id);
    }
  }, [affectations, usagerCircuitId]);

  // Prefill days from the selected affectation when switching to jours_pec
  useEffect(() => {
    if (type === "jours_pec" && selectedAffectation) {
      setDaysAller(normalizeDays(selectedAffectation.daysAller));
      setDaysRetour(normalizeDays(selectedAffectation.daysRetour));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, usagerCircuitId]);

  const createMutation = useMutation(
    trpc.avenants.create.mutationOptions({
      onSuccess: () => {
        if (usagerId) {
          queryClient.invalidateQueries({
            queryKey: trpc.avenants.listByUsager.queryKey({ usagerId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
          });
        }
        toast.success("Avenant créé");
        router.push(usagerId ? `/usagers/${usagerId}` : "/usagers");
      },
      onError: (e) => toast.error(e.message || "Erreur lors de la création"),
    }),
  );

  function buildChange(): AvenantChangeInput | null {
    if (!usagerId) return null;
    if (type === "etablissement") {
      if (!newEtablissementId) return null;
      return { type, usagerId, etablissementId: newEtablissementId };
    }
    if (type === "type_transport") {
      if (!newTransportType) return null;
      return {
        type,
        usagerId,
        transportType:
          newTransportType as (typeof USAGER_TRANSPORT_TYPES)[number],
      };
    }
    if (!usagerCircuitId) return null;
    if (type === "circuit") {
      if (!newCircuitId) return null;
      return {
        type,
        usagerId,
        usagerCircuitId,
        circuitId: newCircuitId,
        ...(newAddressId ? { usagerAddressId: newAddressId } : {}),
      };
    }
    if (type === "jours_pec") {
      return { type, usagerId, usagerCircuitId, daysAller, daysRetour };
    }
    if (!newAddressId) return null;
    return { type, usagerId, usagerCircuitId, usagerAddressId: newAddressId };
  }

  function handleSubmit() {
    const change = buildChange();
    if (!change) {
      toast.error("Renseignez la nouvelle valeur");
      return;
    }
    if (!reason.trim()) {
      toast.error("Le motif est obligatoire");
      return;
    }
    createMutation.mutate({
      circuitId: selectedAffectation?.circuitId ?? null,
      effectiveDate,
      reason: reason.trim(),
      changes: [change],
    });
  }

  const needsAffectation =
    type !== "etablissement" && type !== "type_transport";
  const noAffectations = (affectations?.length ?? 0) === 0;
  // Avertit que le circuit sautera si on bascule vers un mode sans circuit.
  const transportDropsCircuit =
    type === "type_transport" &&
    !!newTransportType &&
    !isCircuitCompatibleTransport(newTransportType) &&
    !noAffectations;

  if (!usagerId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Nouvel avenant</h1>
        <p className="text-sm text-muted-foreground">
          Ouvrez la création d&apos;un avenant depuis la fiche d&apos;un usager
          (onglet Avenants).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/usagers/${usagerId}`)}
          className="-ml-2 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Nouvel avenant
          </h1>
          {usagerLoading ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : (
            usager && (
              <p className="text-sm text-muted-foreground">
                Pour{" "}
                <span className="font-medium text-foreground">
                  {usager.firstName} {usager.lastName}
                </span>
                <span className="ml-2 tabular-nums text-muted-foreground/80">
                  #{usager.displayId}
                </span>
              </p>
            )
          )}
        </div>
      </div>

      {/* Type de changement */}
      <Card>
        <CardHeader>
          <CardTitle>Type de changement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-[0.3rem] border p-4 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary" : ""}`}
                  />
                  {AVENANT_TYPE_LABELS[t.value]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Détail du changement */}
      <Card>
        <CardHeader>
          <CardTitle>Détail</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {needsAffectation && (
            <div className="grid gap-2">
              <Label>Affectation concernée</Label>
              {noAffectations ? (
                <p className="text-sm text-destructive">
                  Cet usager n&apos;est associé à aucun circuit.
                </p>
              ) : (
                <Select value={usagerCircuitId} onValueChange={setUsagerCircuitId}>
                  <SelectTrigger className="w-full cursor-pointer sm:max-w-md">
                    <SelectValue placeholder="Sélectionnez une affectation" />
                  </SelectTrigger>
                  <SelectContent>
                    {affectations?.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="cursor-pointer">
                        {a.circuitName}
                        {a.addressCity ? ` — ${a.addressCity}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {type === "etablissement" && (
            <div className="grid gap-2">
              <Label>Nouvel établissement</Label>
              <Select
                value={newEtablissementId}
                onValueChange={setNewEtablissementId}
              >
                <SelectTrigger className="w-full cursor-pointer sm:max-w-md">
                  <SelectValue placeholder="Sélectionnez un établissement" />
                </SelectTrigger>
                <SelectContent>
                  {etablissements?.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="cursor-pointer">
                      {e.name}
                      {e.city ? ` — ${e.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "type_transport" && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Nouveau type de transport</Label>
                <Select
                  value={newTransportType}
                  onValueChange={setNewTransportType}
                >
                  <SelectTrigger className="w-full cursor-pointer sm:max-w-md">
                    <SelectValue placeholder="Sélectionnez un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGER_TRANSPORT_TYPES.filter(
                      (t) => t !== usager?.transportType,
                    ).map((t) => (
                      <SelectItem key={t} value={t} className="cursor-pointer">
                        {USAGER_TRANSPORT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transportDropsCircuit && (
                <p className="rounded-[0.3rem] border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-foreground">
                  Ce mode ne nécessite pas de circuit : l&apos;affectation
                  circuit actuelle de l&apos;usager sera clôturée à la date
                  d&apos;effet.
                </p>
              )}
            </div>
          )}

          {type === "circuit" && (
            <div className="grid gap-2">
              <Label>Nouveau circuit</Label>
              <Select value={newCircuitId} onValueChange={setNewCircuitId}>
                <SelectTrigger className="w-full cursor-pointer sm:max-w-md">
                  <SelectValue placeholder="Sélectionnez un circuit" />
                </SelectTrigger>
                <SelectContent>
                  {circuits
                    ?.filter((c) => c.id !== selectedAffectation?.circuitId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                        {c.name}
                        {c.etablissementName ? ` — ${c.etablissementName}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "adresse" && (
            <div className="grid gap-2">
              <Label>Nouvelle adresse de prise en charge</Label>
              <Select value={newAddressId} onValueChange={setNewAddressId}>
                <SelectTrigger className="w-full cursor-pointer sm:max-w-md">
                  <SelectValue placeholder="Sélectionnez une adresse" />
                </SelectTrigger>
                <SelectContent>
                  {addresses
                    ?.filter((a) => a.id !== selectedAffectation?.usagerAddressId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id} className="cursor-pointer">
                        {a.type ?? `Adresse ${a.position}`}
                        {a.address ? ` — ${a.address}` : ""}
                        {a.city ? `, ${a.city}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "jours_pec" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Aller</Label>
                <DaySelector value={daysAller} onChange={setDaysAller} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Retour</Label>
                <DaySelector value={daysRetour} onChange={setDaysRetour} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Effet */}
      <Card>
        <CardHeader>
          <CardTitle>Effet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2 sm:max-w-xs">
            <Label>Date d&apos;effet</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Ex: déménagement, changement d'établissement, stage…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;avenant prend effet à cette date. L&apos;ancienne et la
            nouvelle affectation coexistent ; la bascule se fait automatiquement
            le jour J (résolution par date, sans action manuelle).
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/usagers/${usagerId}`)}
          disabled={createMutation.isPending}
          className="cursor-pointer"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || (needsAffectation && noAffectations)}
          className="cursor-pointer"
        >
          {createMutation.isPending ? "Création…" : "Créer l'avenant"}
        </Button>
      </div>
    </div>
  );
}

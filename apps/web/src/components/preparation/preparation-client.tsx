"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogInIcon } from "@/components/ui/log-in-icon";
import { CircuitsClient } from "@/components/circuits/circuits-client";
import { UsagersClient } from "@/components/usagers/usagers-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarDays,
  CopyPlus,
  CheckCircle2,
  Trash2,
  Users,
  Route,
  ChevronDown,
} from "lucide-react";

function formatDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function PreparationClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useQuery(
    trpc.preparation.getCurrentCampaign.queryOptions(),
  );

  // Start form state.
  const [label, setLabel] = useState("");
  const [schoolYearLabel, setSchoolYearLabel] = useState("");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // Active-dashboard state: which embedded list is shown + confirm dialogs.
  const [tab, setTab] = useState<"usagers" | "circuits">("usagers");
  const [activateOpen, setActivateOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  // Slot in the header where the active list portals its Export button.
  const [exportTarget, setExportTarget] = useState<HTMLElement | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.preparation.getCurrentCampaign.queryKey(),
    });
  };

  const startMutation = useMutation(
    trpc.preparation.startCampaign.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Préparation démarrée");
      },
      onError: (e) => toastTrpcError(e, "Erreur au démarrage"),
    }),
  );

  const copyAllMutation = useMutation(
    trpc.preparation.copyAll.mutationOptions({
      onSuccess: (data) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: trpc.circuits.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.usagers.list.queryKey() });
        toast.success(
          `Production copiée : ${data.circuits} circuit(s), ${data.usagers} usager(s)`,
        );
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la copie"),
    }),
  );

  const activateMutation = useMutation(
    trpc.preparation.activate.mutationOptions({
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: trpc.circuits.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.usagers.list.queryKey() });
        toast.success("Préparation activée — elle est devenue la production");
      },
      onError: (e) => toastTrpcError(e, "Erreur lors de l'activation"),
    }),
  );

  const abandonMutation = useMutation(
    trpc.preparation.abandonCampaign.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Préparation abandonnée");
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de l'abandon"),
    }),
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  // ── No campaign: start screen ──────────────────────────────────────────
  if (!campaign) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Préparation de rentrée</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Préparez la prochaine rentrée sur des copies, sans toucher la
            production en cours. Une fois prête, activez-la pour qu&apos;elle
            devienne la nouvelle production.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              Démarrer une préparation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Libellé *</span>
              <Input
                placeholder="Ex. Rentrée 2026-2027"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Année scolaire</span>
              <Input
                placeholder="Ex. 2026-2027"
                value={schoolYearLabel}
                onChange={(e) => setSchoolYearLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Date de rentrée</span>
                <DatePicker value={start} onChange={setStart} clearable />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Fin d&apos;année</span>
                <DatePicker value={end} onChange={setEnd} clearable />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  startMutation.mutate({
                    label: label.trim(),
                    schoolYearLabel: schoolYearLabel.trim() || undefined,
                    targetStartDate: start,
                    targetEndDate: end,
                  })
                }
                disabled={!label.trim() || startMutation.isPending}
                className="cursor-pointer"
              >
                {startMutation.isPending ? "Démarrage…" : "Démarrer la préparation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Active campaign: dashboard ────────────────────────────────────────
  // The Usagers/Circuits switcher is rendered INSIDE the active list's toolbar
  // (via the `prepaTabs` slot), so it sits on the same row as the column picker.
  const switcher = (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "usagers" | "circuits")}
    >
      <TabsList>
        <TabsTrigger value="usagers" className="cursor-pointer gap-1.5">
          <Users className="size-4" />
          Usagers
          <Badge
            variant="secondary"
            className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-xs"
          >
            {campaign.usagerCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="circuits" className="cursor-pointer gap-1.5">
          <Route className="size-4" />
          Circuits
          <Badge
            variant="secondary"
            className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-xs"
          >
            {campaign.circuitCount}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Campaign header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-foreground">
              {campaign.label}
            </h1>
            <Badge variant="secondary" className="gap-1">
              <CalendarDays className="size-3" />
              Préparation en cours
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {campaign.schoolYearLabel ? `${campaign.schoolYearLabel} · ` : ""}
            Rentrée {formatDate(campaign.targetStartDate)} →{" "}
            {formatDate(campaign.targetEndDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* The active list portals its Export button into this slot. */}
          <div ref={setExportTarget} className="contents" />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="cursor-pointer">
              <LogInIcon size={16} className="mr-2" />
              Actions
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={copyAllMutation.isPending}
              onClick={() => copyAllMutation.mutate({ campaignId: campaign.id })}
            >
              <CopyPlus className="mr-2 h-4 w-4" />
              {copyAllMutation.isPending
                ? "Copie…"
                : "Copier toute la production"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setActivateOpen(true)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Activer la préparation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => setAbandonOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Abandonner
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Active list — the switcher lives in its toolbar (next to Colonnes) */}
      {tab === "usagers" ? (
        <UsagersClient
          campaignId={campaign.id}
          prepaTabs={switcher}
          exportTarget={exportTarget}
        />
      ) : (
        <CircuitsClient
          campaignId={campaign.id}
          prepaTabs={switcher}
          exportTarget={exportTarget}
        />
      )}

      {/* Activate / abandon confirmations (controlled from the Actions menu) */}
      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activer la préparation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les fiches de préparation deviennent la <strong>production</strong>.
              La production actuelle remplacée est <strong>archivée</strong>. Cette
              opération s&apos;applique à toute la campagne.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activateMutation.mutate({ id: campaign.id })}
              disabled={activateMutation.isPending}
              className="cursor-pointer"
            >
              Activer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner la préparation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les fiches de préparation seront écartées (la production n&apos;est
              pas touchée). Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => abandonMutation.mutate({ id: campaign.id })}
              disabled={abandonMutation.isPending}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

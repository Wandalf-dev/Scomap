"use client";

import { ArrowLeft, Route, SquarePlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FORM_ID } from "./schemas";

// --- Sticky header — action buttons on the right (like the usager detail page) ---

interface AssociationHeaderProps {
  isEdit: boolean;
  isPending: boolean;
  submitDisabled: boolean;
  ctaLabel: string;
  onBack: () => void;
}

export function AssociationHeader({
  isEdit,
  isPending,
  submitDisabled,
  ctaLabel,
  onBack,
}: AssociationHeaderProps) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 shrink-0 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à la fiche
        </Button>
        <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
          {isEdit ? "Modifier l'association" : "Associer un circuit"}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={isPending}
          className="cursor-pointer"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          size="sm"
          disabled={submitDisabled}
          className="cursor-pointer"
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}

// --- Notice shown when the usager's transport type does not need a circuit ---

interface TransportTypeNoticeProps {
  transportTypeLabel: string | null;
}

export function TransportTypeNotice({
  transportTypeLabel,
}: TransportTypeNoticeProps) {
  return (
    <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
      <p className="text-sm text-foreground">
        Le type de transport de cet usager
        {transportTypeLabel && (
          <>
            {" "}
            (<strong>{transportTypeLabel}</strong>)
          </>
        )}{" "}
        ne nécessite pas de circuit. L&apos;affectation est réservée au
        transport «&nbsp;Taxi collectif / individuel&nbsp;».
      </p>
    </div>
  );
}

// --- Segmented switch between "Circuit existant" / "Nouveau circuit" ---

interface ModeSwitchProps {
  mode: "existing" | "new";
  onSelectExisting: () => void;
  onSelectNew: () => void;
}

export function ModeSwitch({
  mode,
  onSelectExisting,
  onSelectNew,
}: ModeSwitchProps) {
  return (
    <div className="mb-6 grid w-full max-w-md grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      <button
        type="button"
        onClick={onSelectExisting}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "existing"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Route className="size-4" />
        Circuit existant
      </button>
      <button
        type="button"
        onClick={onSelectNew}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "new"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <SquarePlus className="size-4" />
        Nouveau circuit
      </button>
    </div>
  );
}

// --- Loading skeleton ---

export function AssociationSkeleton() {
  return (
    <div className="w-full space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

// --- Empty state when the edited association cannot be found ---

interface AssociationNotFoundProps {
  onBack: () => void;
}

export function AssociationNotFound({ onBack }: AssociationNotFoundProps) {
  return (
    <div className="w-full space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à la fiche
      </Button>
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Association introuvable.
      </div>
    </div>
  );
}

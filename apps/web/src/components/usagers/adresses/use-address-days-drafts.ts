"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { normalizeDays, areDayEntriesEqual, type DayEntry } from "@/lib/types/day-entry";
import { buildDaysData, type DraftDays } from "./address-helpers";
import type { UsagerAddress } from "@scomap/db/schema";

type AddressRow = UsagerAddress & { daysAller: DayEntry[]; daysRetour: DayEntry[] };

interface UseAddressDaysDraftsParams {
  usagerId: string;
  addresses: AddressRow[] | undefined;
  invalidateAddresses: () => void;
}

export function useAddressDaysDrafts({
  usagerId,
  addresses,
  invalidateAddresses,
}: UseAddressDaysDraftsParams) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Draft of the PEC days per address: nothing is written to the database until
  // the user clicks "Enregistrer" (header button). To cancel, they leave the
  // fiche (the Back button warns via the unsaved-changes context).
  const [drafts, setDrafts] = useState<Record<string, DraftDays>>({});
  const [savingDays, setSavingDays] = useState(false);
  const unsaved = useUnsavedChanges();

  // Mutation to save the PEC days (triggered by the header button).
  // Feedback (toast) and invalidations are handled in batch in handleSaveDays —
  // no per-call invalidation (which would multiply refetches and compete with
  // the optimistic cache write).
  const updateDaysMutation = useMutation(
    trpc.usagerAddresses.update.mutationOptions(),
  );

  const listQueryKey = trpc.usagerAddresses.list.queryKey({ usagerId });

  // Current value (draft if edited, otherwise server value) of an address's days.
  function currentDays(a: UsagerAddress): DraftDays {
    return (
      drafts[a.id] ?? {
        aller: normalizeDays(a.daysAller),
        retour: normalizeDays(a.daysRetour),
      }
    );
  }

  function isAddrDaysDirty(a: UsagerAddress): boolean {
    const d = drafts[a.id];
    if (!d) return false;
    return (
      !areDayEntriesEqual(d.aller, normalizeDays(a.daysAller)) ||
      !areDayEntriesEqual(d.retour, normalizeDays(a.daysRetour))
    );
  }

  function handleDaysChange(addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) {
    setDrafts((prev) => ({ ...prev, [addr.id]: { aller, retour } }));
  }

  const dirtyAddresses = (addresses ?? []).filter(isAddrDaysDirty);
  const daysDirty = dirtyAddresses.length > 0;

  async function handleSaveDays() {
    if (!daysDirty || savingDays) return;
    setSavingDays(true);
    const targets = dirtyAddresses;
    const results = await Promise.allSettled(
      targets.map((a) => {
        const d = drafts[a.id]!;
        return updateDaysMutation.mutateAsync({
          id: a.id,
          data: { ...buildDaysData(a), daysAller: d.aller, daysRetour: d.retour },
        });
      }),
    );
    // Only purge the drafts that were actually saved.
    const savedIds = targets
      .filter((_, i) => results[i]!.status === "fulfilled")
      .map((a) => a.id);
    if (savedIds.length > 0) {
      // Write the saved days into the cache (optimistic) to avoid a flash of
      // the old value before the refetch, then purge the corresponding draft.
      queryClient.setQueryData(listQueryKey, (old: typeof addresses) => {
        if (!old) return old;
        return old.map((a) =>
          savedIds.includes(a.id)
            ? { ...a, daysAller: drafts[a.id]!.aller, daysRetour: drafts[a.id]!.retour }
            : a,
        );
      });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const id of savedIds) delete next[id];
        return next;
      });
      // Server reconciliation, once for the whole batch.
      invalidateAddresses();
      queryClient.invalidateQueries({
        queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
      });
    }
    setSavingDays(false);
    if (results.some((r) => r.status === "rejected")) {
      toast.error("Erreur lors de l'enregistrement des jours");
    } else {
      toast.success("Jours de prise en charge enregistrés");
    }
  }

  // Report the unsaved days to the layout: the "Retour" button then warns
  // before leaving the fiche (and that is how one "cancels").
  const setUnsavedDirty = unsaved?.setDirty;
  useEffect(() => {
    setUnsavedDirty?.("usager-adresses-days", daysDirty);
    return () => setUnsavedDirty?.("usager-adresses-days", false);
  }, [daysDirty, setUnsavedDirty]);

  return {
    savingDays,
    daysDirty,
    currentDays,
    handleDaysChange,
    handleSaveDays,
  };
}

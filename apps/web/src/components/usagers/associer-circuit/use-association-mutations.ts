"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";

interface UseAssociationMutationsParams {
  usagerId: string;
  onSaved: () => void;
}

export function useAssociationMutations({
  usagerId,
  onSaved,
}: UseAssociationMutationsParams) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByUsager.queryKey({ usagerId }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.circuits.list.queryKey() });
    // Associating/dissociating changes the circuit's usagerCount → refresh the
    // circuit detail page (date lock) without targeting a specific id.
    queryClient.invalidateQueries({
      queryKey: trpc.circuits.getById.queryKey(),
    });
    // The association creates/completes trajets + arrêts (syncTrajetForDirection):
    // we invalidate so the preview and the circuit views reflect the new state.
    queryClient.invalidateQueries({
      queryKey: trpc.trajets.listByCircuit.queryKey(),
    });
    queryClient.invalidateQueries({ queryKey: trpc.arrets.list.queryKey() });
    // List of the circuit's usagers (Usagers tab of the circuit detail page).
    queryClient.invalidateQueries({
      queryKey: trpc.usagerCircuits.listByCircuit.queryKey(),
    });
    // Joining a circuit that has already started creates an automatic "ajout"
    // avenant: refresh the avenant timelines. listByUsager without argument =
    // all usagers (the avenant becomes visible for the OTHER usagers of the
    // circuit).
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByUsager.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.avenants.listByCircuit.queryKey(),
    });
  };

  const createMutation = useMutation(
    trpc.usagerCircuits.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit associé");
        onSaved();
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de l'association"),
    }),
  );
  const updateMutation = useMutation(
    trpc.usagerCircuits.update.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Circuit modifié");
        onSaved();
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la modification"),
    }),
  );
  const createCircuitMutation = useMutation(
    trpc.circuits.createFull.mutationOptions({
      onError: (err) => toastTrpcError(err, "Erreur lors de la création du circuit"),
    }),
  );

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    createCircuitMutation.isPending;

  return { createMutation, updateMutation, createCircuitMutation, isPending };
}

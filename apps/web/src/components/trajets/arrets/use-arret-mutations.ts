"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";

interface UseArretMutationsOptions {
  trajetId: string;
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onDeleteSuccess: () => void;
}

export function useArretMutations({
  trajetId,
  onCreateSuccess,
  onUpdateSuccess,
  onDeleteSuccess,
}: UseArretMutationsOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // EXACT key of the list query displayed in the tab: optimistic updates must
  // write to this entry (a different input = another cache entry → the UI
  // would only move after the server refetch).
  const listQueryKey = trpc.arrets.list.queryKey({ trajetId, all: true });

  const createMutation = useMutation(
    trpc.arrets.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arrêt ajouté");
        onCreateSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'ajout");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.arrets.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arrêt modifié");
        onUpdateSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.arrets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
        toast.success("Arrêt supprimé");
        onDeleteSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const toggleLockMutation = useMutation(
    trpc.arrets.toggleTimeLock.mutationOptions({
      onMutate: async ({ id }) => {
        const queryKey = listQueryKey;
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === id ? { ...a, timeLocked: !a.timeLocked } : a,
          );
        });
        return { previous };
      },
      onError: (err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listQueryKey, context.previous);
        }
        toastTrpcError(err, "Erreur lors du verrouillage");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

  const reorderMutation = useMutation(
    trpc.arrets.reorder.mutationOptions({
      onMutate: async ({ items }) => {
        const queryKey = listQueryKey;
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          const posMap = new Map(items.map((i) => [i.id, i.orderIndex]));
          return [...old]
            .map((a) => ({ ...a, orderIndex: posMap.get(a.id) ?? a.orderIndex }))
            .sort((a, b) => a.orderIndex - b.orderIndex);
        });
        return { previous };
      },
      onError: (err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listQueryKey, context.previous);
        }
        toastTrpcError(err, "Erreur lors du réordonnancement");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

  const setTimeMutation = useMutation(
    trpc.arrets.setArrivalTime.mutationOptions({
      onMutate: async ({ id, arrivalTime }) => {
        const queryKey = listQueryKey;
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === id ? { ...a, arrivalTime: arrivalTime || null } : a,
          );
        });
        return { previous };
      },
      onError: (err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(listQueryKey, context.previous);
        }
        toastTrpcError(err, "Erreur lors de la mise à jour de l'horaire");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.arrets.list.queryKey({ trajetId }),
        });
      },
    }),
  );

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    toggleLockMutation,
    reorderMutation,
    setTimeMutation,
  };
}

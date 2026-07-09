import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";

interface UseUsagerListMutationsOptions {
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onDeleteSuccess: () => void;
  onUpdateDatesSuccess: () => void;
}

export function useUsagerListMutations({
  onCreateSuccess,
  onUpdateSuccess,
  onDeleteSuccess,
  onUpdateDatesSuccess,
}: UseUsagerListMutationsOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const copyToPrepaMutation = useMutation(
    trpc.preparation.copyUsagers.mutationOptions({
      onSuccess: (data) => {
        // Keep the campaign counts (switcher badges) and its scoped list in sync.
        queryClient.invalidateQueries({
          queryKey: trpc.preparation.getCurrentCampaign.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(
          `${data.copied} usager${data.copied > 1 ? "s" : ""} copié${data.copied > 1 ? "s" : ""} en préparation`,
        );
      },
      onError: (err) => toastTrpcError(err, "Erreur lors de la copie en préparation"),
    }),
  );

  const createMutation = useMutation(
    trpc.usagers.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager créé avec succès");
        onCreateSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.usagers.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager modifié avec succès");
        onUpdateSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprimé");
        onDeleteSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const deleteManyMutation = useMutation(
    trpc.usagers.deleteMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(`${data.deleted} élément${data.deleted > 1 ? "s" : ""} supprimé${data.deleted > 1 ? "s" : ""}`);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la suppression");
      },
    }),
  );

  const updateDatesManyMutation = useMutation(
    trpc.usagers.updateTransportDatesMany.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(
          `Dates mises à jour pour ${data.updated} usager${data.updated > 1 ? "s" : ""}`,
        );
        onUpdateDatesSuccess();
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la mise à jour des dates");
      },
    }),
  );

  const archiveMutation = useMutation(
    trpc.usagers.setArchived.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success(variables.archived ? "Usager archivé" : "Usager désarchivé");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'archivage");
      },
    }),
  );

  return {
    copyToPrepaMutation,
    createMutation,
    updateMutation,
    deleteMutation,
    deleteManyMutation,
    updateDatesManyMutation,
    archiveMutation,
  };
}

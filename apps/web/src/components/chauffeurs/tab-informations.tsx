"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  chauffeurDetailSchema,
  type ChauffeurDetailFormValues,
} from "@/lib/validators/chauffeur";
import { Button } from "@/components/ui/button";
import { ChauffeurFormFields } from "./chauffeur-form-fields";

interface ChauffeurData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  hireDate: string | null;
  notes: string | null;
}

interface TabInformationsProps {
  chauffeur: ChauffeurData;
}

export function TabInformations({ chauffeur }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "chauffeur-informations-form";

  const form = useForm<ChauffeurDetailFormValues>({
    resolver: zodResolver(chauffeurDetailSchema),
    defaultValues: {
      firstName: chauffeur.firstName,
      lastName: chauffeur.lastName,
      email: chauffeur.email ?? "",
      phone: chauffeur.phone ?? "",
      address: chauffeur.address ?? "",
      hireDate: chauffeur.hireDate ?? "",
      notes: chauffeur.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.chauffeurs.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.getById.queryKey({ id: chauffeur.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur enregistré");
        // Resets the form to pristine state after saving.
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/chauffeurs");
        }
        exitAfterSaveRef.current = false;
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  function onSubmit(values: ChauffeurDetailFormValues) {
    mutation.mutate({ id: chauffeur.id, data: values });
  }

  // Syncs the dirty state with the layout context (stable `setDirty`
  // dependency only, see tab-identite for usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("chauffeur-informations", isDirty);
    return () => setDirty?.("chauffeur-informations", false);
  }, [isDirty, setDirty]);

  return (
    <>
      {headerActions?.target &&
        createPortal(
          <>
            <Button
              type="submit"
              form={formId}
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => {
                exitAfterSaveRef.current = false;
              }}
              className="cursor-pointer"
            >
              {mutation.isPending && !exitAfterSaveRef.current
                ? "Enregistrement..."
                : "Enregistrer"}
            </Button>
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={mutation.isPending}
              onClick={() => {
                exitAfterSaveRef.current = true;
              }}
              className="cursor-pointer"
            >
              {mutation.isPending && exitAfterSaveRef.current
                ? "Enregistrement..."
                : "Enregistrer et quitter"}
            </Button>
          </>,
          headerActions.target,
        )}

      <ChauffeurFormFields form={form} formId={formId} onSubmit={onSubmit} />
    </>
  );
}

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
  vehiculeDetailSchema,
  type VehiculeDetailFormValues,
} from "@/lib/validators/vehicule";
import { Button } from "@/components/ui/button";
import { VehiculeFormFields } from "./vehicule-form-fields";

interface VehiculeData {
  id: string;
  name: string;
  licensePlate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  capacity: number | null;
  wheelchairAccessible: boolean | null;
  notes: string | null;
}

interface TabInformationsProps {
  vehicule: VehiculeData;
}

export function TabInformations({ vehicule }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "vehicule-informations-form";

  const form = useForm<VehiculeDetailFormValues>({
    resolver: zodResolver(vehiculeDetailSchema),
    defaultValues: {
      name: vehicule.name,
      licensePlate: vehicule.licensePlate ?? "",
      brand: vehicule.brand ?? "",
      model: vehicule.model ?? "",
      year: vehicule.year?.toString() ?? "",
      capacity: vehicule.capacity?.toString() ?? "",
      wheelchairAccessible: vehicule.wheelchairAccessible ?? false,
      notes: vehicule.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.vehicules.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.getById.queryKey({ id: vehicule.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Véhicule enregistré");
        // Resets the form to pristine state after saving.
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/vehicules");
        }
        exitAfterSaveRef.current = false;
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  function onSubmit(values: VehiculeDetailFormValues) {
    mutation.mutate({ id: vehicule.id, data: values });
  }

  // Syncs the dirty state with the layout context (stable `setDirty`
  // dependency only, see tab-identite for usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("vehicule-informations", isDirty);
    return () => setDirty?.("vehicule-informations", false);
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

      <VehiculeFormFields form={form} formId={formId} onSubmit={onSubmit} />
    </>
  );
}

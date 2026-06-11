"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "nextjs-toploader/app";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  usagerDetailSchema,
  USAGER_STATUSES,
  USAGER_REGIMES,
  USAGER_TRANSPORT_TYPES,
  type UsagerDetailFormValues,
} from "@/lib/validators/usager";
import { Button } from "@/components/ui/button";
import { UsagerFormFields } from "./usager-form-fields";

interface UsagerData {
  id: string;
  displayId: number;
  code: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  status: string;
  regime: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  etablissementType: string | null;
  secondaryEtablissementId: string | null;
  secondaryEtablissementName: string | null;
  classe: string | null;
  transportType: string | null;
  distanceKm: number | null;
  transportStartDate: string | null;
  transportEndDate: string | null;
  transportParticularity: string | null;
  specificity: string | null;
  notes: string | null;
}

interface TabIdentiteProps {
  usager: UsagerData;
}

export function TabIdentite({ usager }: TabIdentiteProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "usager-identite-form";

  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  // Once a circuit assignment exists, critical fields (établissement, transport
  // type, transport dates) are locked: they can only be changed via an avenant
  // for traceability.
  const { data: affectations } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId: usager.id }),
  );
  const affectationLocked = (affectations?.length ?? 0) > 0;

  const form = useForm<UsagerDetailFormValues>({
    resolver: zodResolver(usagerDetailSchema),
    defaultValues: {
      code: usager.code ?? "",
      firstName: usager.firstName,
      lastName: usager.lastName,
      birthDate: usager.birthDate ?? "",
      gender: (usager.gender as "M" | "F" | "") ?? "",
      status: (usager.status as typeof USAGER_STATUSES[number]) ?? "non_controle",
      regime: (usager.regime as typeof USAGER_REGIMES[number] | "") ?? "",
      etablissementId: usager.etablissementId ?? "",
      secondaryEtablissementId: usager.secondaryEtablissementId ?? "",
      classe: usager.classe ?? "",
      transportType: (usager.transportType as typeof USAGER_TRANSPORT_TYPES[number] | "") ?? "",
      distanceKm: usager.distanceKm ?? null,
      transportStartDate: usager.transportStartDate ?? "",
      transportEndDate: usager.transportEndDate ?? null,
      transportParticularity: usager.transportParticularity ?? "",
      specificity: usager.specificity ?? "",
      notes: usager.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.usagers.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.getById.queryKey({ id: usager.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager enregistré");
        // Reset form to mark it clean (isDirty = false)
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/usagers");
        }
        exitAfterSaveRef.current = false;
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  const computeDistanceMutation = useMutation(
    trpc.usagers.computeDistance.mutationOptions({
      onSuccess: ({ km }) => {
        form.setValue("distanceKm", km, { shouldDirty: true });
        toast.success(`Distance calculée : ${km} km`);
      },
      onError: (err) => toastTrpcError(err, "Erreur lors du calcul de la distance"),
    }),
  );

  function onSubmit(values: UsagerDetailFormValues) {
    mutation.mutate({ id: usager.id, data: values });
  }

  // Sync form dirty state with the layout's unsaved-changes context.
  // We depend on `setDirty` (stable via useCallback in the provider) and NOT on
  // the full `unsaved` object: the latter changes reference on every `dirtyKeys`
  // change, which would re-trigger this effect in a loop
  // (cleanup → false, body → true → dirtyKeys change → unsaved change → …) and
  // cause "Maximum update depth exceeded".
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("usager-identite", isDirty);
    return () => setDirty?.("usager-identite", false);
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
      <UsagerFormFields
        form={form}
        formId={formId}
        onSubmit={onSubmit}
        etablissements={etablissements}
        displayId={usager.displayId}
        affectationLocked={affectationLocked}
        avenantHref={`/avenants/new?usagerId=${usager.id}`}
        onComputeDistance={() => computeDistanceMutation.mutate({ id: usager.id })}
        computingDistance={computeDistanceMutation.isPending}
      />
    </>
  );
}

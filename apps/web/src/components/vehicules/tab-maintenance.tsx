"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import {
  vehiculeMaintenanceSchema,
  type VehiculeMaintenanceFormValues,
} from "@/lib/validators/vehicule";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VehiculeMaintenanceData {
  id: string;
  insuranceExpiry: string | null;
  technicalControlExpiry: string | null;
}

interface TabMaintenanceProps {
  vehicule: VehiculeMaintenanceData;
}

export function TabMaintenance({ vehicule }: TabMaintenanceProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const formId = "vehicule-maintenance-form";

  const form = useForm<VehiculeMaintenanceFormValues>({
    resolver: zodResolver(vehiculeMaintenanceSchema),
    defaultValues: {
      insuranceExpiry: vehicule.insuranceExpiry ?? "",
      technicalControlExpiry: vehicule.technicalControlExpiry ?? "",
    },
  });

  const mutation = useMutation(
    trpc.vehicules.updateMaintenance.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.getById.queryKey({ id: vehicule.id }),
        });
        toast.success("Maintenance enregistrée");
        // Repasse le formulaire en pristine après sauvegarde.
        form.reset(variables.data);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: VehiculeMaintenanceFormValues) {
    mutation.mutate({ id: vehicule.id, data: values });
  }

  // Synchronise l'état dirty avec le contexte du layout (dépendance sur
  // `setDirty` stable uniquement, cf. tab-identite des usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("vehicule-maintenance", isDirty);
    return () => setDirty?.("vehicule-maintenance", false);
  }, [isDirty, setDirty]);

  return (
    <Form {...form}>
      {headerActions?.target &&
        createPortal(
          <Button
            type="submit"
            form={formId}
            size="sm"
            disabled={mutation.isPending || !form.formState.isDirty}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>,
          headerActions.target,
        )}
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Assurance */}
        <Card>
          <CardHeader>
            <CardTitle>Assurance</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="insuranceExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d&apos;expiration</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Contrôle technique */}
        <Card>
          <CardHeader>
            <CardTitle>Contrôle technique</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="technicalControlExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d&apos;expiration</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

      </form>
    </Form>
  );
}

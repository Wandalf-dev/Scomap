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
  vehiculeMaintenanceSchema,
  type VehiculeMaintenanceFormValues,
} from "@/lib/validators/vehicule";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Wrench } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";

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
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
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

  function onSubmit(values: VehiculeMaintenanceFormValues) {
    mutation.mutate({ id: vehicule.id, data: values });
  }

  // Syncs the dirty state with the layout context (stable `setDirty`
  // dependency only, see tab-identite for usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("vehicule-maintenance", isDirty);
    return () => setDirty?.("vehicule-maintenance", false);
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

      <Form {...form}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Insurance */}
            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={ShieldCheck}>Assurance</SectionHeader>
              <FormField
                control={form.control}
                name="insuranceExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d&apos;expiration</FormLabel>
                    <DatePicker
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      clearable
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* Technical inspection */}
            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={Wrench}>Contrôle technique</SectionHeader>
              <FormField
                control={form.control}
                name="technicalControlExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d&apos;expiration</FormLabel>
                    <DatePicker
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      clearable
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </div>
        </form>
      </Form>
    </>
  );
}

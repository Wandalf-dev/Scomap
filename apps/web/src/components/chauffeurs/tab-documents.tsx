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
  chauffeurDocumentsSchema,
  type ChauffeurDocumentsFormValues,
} from "@/lib/validators/chauffeur";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { IdCard, HeartPulse } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";

interface ChauffeurDocumentsData {
  id: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  medicalCertificateExpiry: string | null;
}

interface TabDocumentsProps {
  chauffeur: ChauffeurDocumentsData;
}

export function TabDocuments({ chauffeur }: TabDocumentsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "chauffeur-documents-form";

  const form = useForm<ChauffeurDocumentsFormValues>({
    resolver: zodResolver(chauffeurDocumentsSchema),
    defaultValues: {
      licenseNumber: chauffeur.licenseNumber ?? "",
      licenseExpiry: chauffeur.licenseExpiry ?? "",
      medicalCertificateExpiry: chauffeur.medicalCertificateExpiry ?? "",
    },
  });

  const mutation = useMutation(
    trpc.chauffeurs.updateDocuments.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.getById.queryKey({ id: chauffeur.id }),
        });
        toast.success("Documents enregistrés");
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

  function onSubmit(values: ChauffeurDocumentsFormValues) {
    mutation.mutate({ id: chauffeur.id, data: values });
  }

  // Syncs the dirty state with the layout context (stable `setDirty`
  // dependency only, see tab-identite for usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("chauffeur-documents", isDirty);
    return () => setDirty?.("chauffeur-documents", false);
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
            {/* Driver's license */}
            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={IdCard}>Permis de conduire</SectionHeader>
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de permis</FormLabel>
                    <FormControl>
                      <Input placeholder="Numéro de permis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseExpiry"
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

            {/* Medical certificate */}
            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={HeartPulse}>Certificat médical</SectionHeader>
              <FormField
                control={form.control}
                name="medicalCertificateExpiry"
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

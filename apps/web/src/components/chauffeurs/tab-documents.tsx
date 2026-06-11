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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
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
        // Repasse le formulaire en pristine après sauvegarde.
        form.reset(variables.data);
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: ChauffeurDocumentsFormValues) {
    mutation.mutate({ id: chauffeur.id, data: values });
  }

  // Synchronise l'état dirty avec le contexte du layout (dépendance sur
  // `setDirty` stable uniquement, cf. tab-identite des usagers).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("chauffeur-documents", isDirty);
    return () => setDirty?.("chauffeur-documents", false);
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
        {/* Permis de conduire */}
        <Card>
          <CardHeader>
            <CardTitle>Permis de conduire</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
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
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Certificat médical */}
        <Card>
          <CardHeader>
            <CardTitle>Certificat médical</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="medicalCertificateExpiry"
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

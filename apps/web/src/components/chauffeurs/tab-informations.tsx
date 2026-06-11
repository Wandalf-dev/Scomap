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
  chauffeurDetailSchema,
  type ChauffeurDetailFormValues,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
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
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
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
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemple.fr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="06 12 34 56 78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Adresse complète..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Hire date */}
        <Card>
          <CardHeader>
            <CardTitle>Embauche</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="hireDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d&apos;embauche</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Notes libres..."
                      rows={4}
                      {...field}
                    />
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

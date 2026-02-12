"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
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
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.getById.queryKey({ id: chauffeur.id }),
        });
        toast.success("Documents enregistres");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: ChauffeurDocumentsFormValues) {
    mutation.mutate({ id: chauffeur.id, data: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <FormLabel>Numero de permis</FormLabel>
                  <FormControl>
                    <Input placeholder="Numero de permis" {...field} />
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

        {/* Certificat medical */}
        <Card>
          <CardHeader>
            <CardTitle>Certificat medical</CardTitle>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

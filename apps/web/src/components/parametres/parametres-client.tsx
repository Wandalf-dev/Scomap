"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const settingsSchema = z.object({
  schoolYearStart: z.string().nullable(),
  schoolYearEnd: z.string().nullable(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function ParametresClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    trpc.tenantSettings.get.queryOptions(),
  );

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: {
      schoolYearStart: settings?.schoolYearStart ?? null,
      schoolYearEnd: settings?.schoolYearEnd ?? null,
    },
  });

  const mutation = useMutation(
    trpc.tenantSettings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.tenantSettings.get.queryKey(),
        });
        toast.success("Paramètres enregistrés");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: SettingsFormValues) {
    mutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">
            Configuration générale de votre espace
          </p>
        </div>
        <div className="h-48 animate-pulse rounded-[0.5rem] bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration générale de votre espace
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle>Année scolaire</CardTitle>
              </div>
              <CardDescription>
                Définissez les dates de l&apos;année scolaire en cours. Ces dates
                seront utilisées pour pré-remplir automatiquement les dates de
                début et fin de transport lors de la création d&apos;un usager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <FormField
                  control={form.control}
                  name="schoolYearStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        clearable
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schoolYearEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de fin</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        clearable
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="cursor-pointer"
            >
              {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

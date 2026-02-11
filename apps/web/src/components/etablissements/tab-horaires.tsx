"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  schedulesSchema,
  type SchedulesFormValues,
} from "@/lib/validators/etablissement";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy } from "lucide-react";
import type { Etablissement } from "@scomap/db/schema";

const DAYS = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
] as const;

const DEFAULT_SCHEDULES: SchedulesFormValues = {
  lundi: { morning: "", evening: "" },
  mardi: { morning: "", evening: "" },
  mercredi: { morning: "", evening: "" },
  jeudi: { morning: "", evening: "" },
  vendredi: { morning: "", evening: "" },
  samedi: { morning: "", evening: "" },
  dimanche: { morning: "", evening: "" },
};

interface TabHorairesProps {
  etablissement: Etablissement;
}

export function TabHoraires({ etablissement }: TabHorairesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const savedSchedules = etablissement.schedules as SchedulesFormValues | null;

  const form = useForm<SchedulesFormValues>({
    resolver: zodResolver(schedulesSchema),
    defaultValues: savedSchedules ?? DEFAULT_SCHEDULES,
  });

  const mutation = useMutation(
    trpc.etablissements.updateSchedules.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.getById.queryKey({ id: etablissement.id }),
        });
        toast.success("Horaires enregistrés");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: SchedulesFormValues) {
    mutation.mutate({ id: etablissement.id, schedules: values });
  }

  function copyMondayToAll() {
    const lundi = form.getValues("lundi");
    for (const day of DAYS) {
      if (day.key !== "lundi") {
        form.setValue(`${day.key}.morning`, lundi.morning ?? "");
        form.setValue(`${day.key}.evening`, lundi.evening ?? "");
      }
    }
    toast.success("Horaires du lundi copiés");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Horaires hebdomadaires</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyMondayToAll}
              className="cursor-pointer"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copier lundi partout
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* En-tête */}
              <div className="grid grid-cols-[140px_1fr_1fr] gap-4 text-sm font-medium text-muted-foreground">
                <div>Jour</div>
                <div>Matin</div>
                <div>Soir</div>
              </div>

              {/* Lignes */}
              {DAYS.map((day) => (
                <div key={day.key} className="grid grid-cols-[140px_1fr_1fr] items-center gap-4">
                  <div className="text-sm font-medium">{day.label}</div>
                  <FormField
                    control={form.control}
                    name={`${day.key}.morning`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            value={field.value ?? ""}
                            className="cursor-pointer"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`${day.key}.evening`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            value={field.value ?? ""}
                            className="cursor-pointer"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
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

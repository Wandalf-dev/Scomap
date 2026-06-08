"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  schedulesSchema,
  type SchedulesFormValues,
} from "@/lib/validators/etablissement";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "etablissement-horaires-form";

  // Valide la structure jsonb au lieu d'un cast aveugle : une donnée inattendue
  // en base retombe proprement sur les valeurs par défaut.
  const parsedSchedules = schedulesSchema.safeParse(etablissement.schedules);
  const savedSchedules = parsedSchedules.success ? parsedSchedules.data : null;

  const form = useForm<SchedulesFormValues>({
    resolver: zodResolver(schedulesSchema),
    defaultValues: savedSchedules ?? DEFAULT_SCHEDULES,
  });

  const mutation = useMutation(
    trpc.etablissements.updateSchedules.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.getById.queryKey({ id: etablissement.id }),
        });
        toast.success("Horaires enregistrés");
        form.reset(variables.schedules);
        if (exitAfterSaveRef.current) {
          router.push("/etablissements");
        }
        exitAfterSaveRef.current = false;
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  function onSubmit(values: SchedulesFormValues) {
    mutation.mutate({ id: etablissement.id, schedules: values });
  }

  // Synchronise l'état « modifié » avec le bandeau (avertissement au retour).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("etablissement-horaires", isDirty);
    return () => setDirty?.("etablissement-horaires", false);
  }, [isDirty, setDirty]);

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
                <div key={day.key} className="grid grid-cols-[140px_1fr_1fr] items-start gap-4">
                  <div className="pt-2 text-sm font-medium">
                    {day.label}
                    {day.key === "lundi" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </div>
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
                        <FormMessage />
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
        </form>
      </Form>
    </>
  );
}

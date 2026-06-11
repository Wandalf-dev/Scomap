"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { ArrowLeft } from "lucide-react";
import {
  usagerDetailSchema,
  type UsagerDetailFormValues,
} from "@/lib/validators/usager";
import { Button } from "@/components/ui/button";
import { UsagerFormFields } from "./usager-form-fields";

const FORM_ID = "usager-create-form";

export function UsagerCreateClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const { data: settings } = useQuery(
    trpc.tenantSettings.get.queryOptions(),
  );

  const form = useForm<UsagerDetailFormValues>({
    resolver: zodResolver(usagerDetailSchema),
    defaultValues: {
      code: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      etablissementId: "",
      transportType: "",
      transportStartDate: settings?.schoolYearStart ?? "",
      transportEndDate: settings?.schoolYearEnd ?? null,
      notes: "",
    },
  });

  // Pré-remplit les dates de transport quand les paramètres (année scolaire)
  // arrivent, sans écraser une saisie en cours (on ne touche qu'aux dates vides).
  useEffect(() => {
    if (!settings) return;
    form.reset({
      ...form.getValues(),
      transportStartDate:
        form.getValues("transportStartDate") || (settings.schoolYearStart ?? ""),
      transportEndDate:
        form.getValues("transportEndDate") || (settings.schoolYearEnd ?? null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const mutation = useMutation(
    trpc.usagers.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager créé");
        router.push(data?.id ? `/usagers/${data.id}` : "/usagers");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  function onSubmit(values: UsagerDetailFormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="space-y-6">
      {/* Header — même bandeau que la fiche usager */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/usagers")}
            className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </Button>
          <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
            Nouvel usager
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="submit"
            form={FORM_ID}
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Création..." : "Créer l'usager"}
          </Button>
        </div>
      </div>

      <UsagerFormFields
        form={form}
        formId={FORM_ID}
        onSubmit={onSubmit}
        etablissements={etablissements}
      />
    </div>
  );
}

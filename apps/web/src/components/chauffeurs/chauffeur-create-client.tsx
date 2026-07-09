"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { ArrowLeft } from "lucide-react";
import {
  chauffeurDetailSchema,
  type ChauffeurDetailFormValues,
} from "@/lib/validators/chauffeur";
import { Button } from "@/components/ui/button";
import { ChauffeurFormFields } from "./chauffeur-form-fields";

export function ChauffeurCreateClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const formId = "chauffeur-create-form";

  const form = useForm<ChauffeurDetailFormValues>({
    resolver: zodResolver(chauffeurDetailSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      hireDate: "",
      notes: "",
    },
  });

  const mutation = useMutation(
    trpc.chauffeurs.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur créé");
        router.push(data?.id ? `/chauffeurs/${data.id}` : "/chauffeurs");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  function onSubmit(values: ChauffeurDetailFormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          effect="expandIcon"
          icon={ArrowLeft}
          iconPlacement="left"
          size="sm"
          onClick={() => router.push("/chauffeurs")}
          className="cursor-pointer"
        >
          Retour
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouveau chauffeur
        </h1>
      </div>

      <ChauffeurFormFields form={form} formId={formId} onSubmit={onSubmit} />

      <div className="flex justify-end">
        <Button
          type="submit"
          form={formId}
          disabled={mutation.isPending}
          className="cursor-pointer"
        >
          {mutation.isPending ? "Création..." : "Créer le chauffeur"}
        </Button>
      </div>
    </div>
  );
}

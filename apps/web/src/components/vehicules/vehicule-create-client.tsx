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
  vehiculeDetailSchema,
  type VehiculeDetailFormValues,
} from "@/lib/validators/vehicule";
import { Button } from "@/components/ui/button";
import { VehiculeFormFields } from "./vehicule-form-fields";

export function VehiculeCreateClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const formId = "vehicule-create-form";

  const form = useForm<VehiculeDetailFormValues>({
    resolver: zodResolver(vehiculeDetailSchema),
    defaultValues: {
      name: "",
      licensePlate: "",
      brand: "",
      model: "",
      year: "",
      capacity: "",
      wheelchairAccessible: false,
      notes: "",
    },
  });

  const mutation = useMutation(
    trpc.vehicules.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Véhicule créé");
        router.push(data?.id ? `/vehicules/${data.id}` : "/vehicules");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
      },
    }),
  );

  function onSubmit(values: VehiculeDetailFormValues) {
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
          onClick={() => router.push("/vehicules")}
          className="cursor-pointer"
        >
          Retour
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouveau véhicule
        </h1>
      </div>

      <VehiculeFormFields form={form} formId={formId} onSubmit={onSubmit} />

      <div className="flex justify-end">
        <Button
          type="submit"
          form={formId}
          disabled={mutation.isPending}
          className="cursor-pointer"
        >
          {mutation.isPending ? "Création..." : "Créer le véhicule"}
        </Button>
      </div>
    </div>
  );
}

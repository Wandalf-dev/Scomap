"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  vehiculeMaintenanceSchema,
  type VehiculeMaintenanceFormValues,
} from "@/lib/validators/vehicule";
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

interface VehiculeMaintenanceData {
  id: string;
  insuranceExpiry: string | null;
  technicalControlExpiry: string | null;
}

interface TabMaintenanceProps {
  vehicule: VehiculeMaintenanceData;
}

export function TabMaintenance({ vehicule }: TabMaintenanceProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<VehiculeMaintenanceFormValues>({
    resolver: zodResolver(vehiculeMaintenanceSchema),
    defaultValues: {
      insuranceExpiry: vehicule.insuranceExpiry ?? "",
      technicalControlExpiry: vehicule.technicalControlExpiry ?? "",
    },
  });

  const mutation = useMutation(
    trpc.vehicules.updateMaintenance.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.getById.queryKey({ id: vehicule.id }),
        });
        toast.success("Maintenance enregistree");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: VehiculeMaintenanceFormValues) {
    mutation.mutate({ id: vehicule.id, data: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Assurance */}
        <Card>
          <CardHeader>
            <CardTitle>Assurance</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="insuranceExpiry"
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

        {/* Controle technique */}
        <Card>
          <CardHeader>
            <CardTitle>Controle technique</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="technicalControlExpiry"
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

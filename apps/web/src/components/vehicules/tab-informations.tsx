"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  vehiculeDetailSchema,
  type VehiculeDetailFormValues,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VehiculeData {
  id: string;
  name: string;
  licensePlate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  capacity: number | null;
  wheelchairAccessible: boolean | null;
  notes: string | null;
}

interface TabInformationsProps {
  vehicule: VehiculeData;
}

export function TabInformations({ vehicule }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<VehiculeDetailFormValues>({
    resolver: zodResolver(vehiculeDetailSchema),
    defaultValues: {
      name: vehicule.name,
      licensePlate: vehicule.licensePlate ?? "",
      brand: vehicule.brand ?? "",
      model: vehicule.model ?? "",
      year: vehicule.year?.toString() ?? "",
      capacity: vehicule.capacity?.toString() ?? "",
      wheelchairAccessible: vehicule.wheelchairAccessible ?? false,
      notes: vehicule.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.vehicules.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.getById.queryKey({ id: vehicule.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule enregistre");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: VehiculeDetailFormValues) {
    mutation.mutate({ id: vehicule.id, data: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du vehicule" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licensePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Immatriculation</FormLabel>
                    <FormControl>
                      <Input placeholder="AA-123-BB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacite</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Nombre de places"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marque</FormLabel>
                    <FormControl>
                      <Input placeholder="Marque" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modele</FormLabel>
                    <FormControl>
                      <Input placeholder="Modele" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annee</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2024"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Accessibilite */}
        <Card>
          <CardHeader>
            <CardTitle>Accessibilite</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="wheelchairAccessible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="cursor-pointer"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Accessible fauteuil roulant
                    </FormLabel>
                  </div>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

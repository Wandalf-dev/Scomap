"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  circuitDetailSchema,
  type CircuitDetailFormValues,
} from "@/lib/validators/circuit";
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

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

interface CircuitData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  operatingDays: unknown;
}

interface TabInformationsProps {
  circuit: CircuitData;
}

export function TabInformations({ circuit }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const days = Array.isArray(circuit.operatingDays) ? (circuit.operatingDays as number[]) : [];

  const form = useForm<CircuitDetailFormValues>({
    resolver: zodResolver(circuitDetailSchema),
    defaultValues: {
      name: circuit.name,
      description: circuit.description ?? "",
      operatingDays: days,
    },
  });

  const mutation = useMutation(
    trpc.circuits.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey({ id: circuit.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit enregistre");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: CircuitDetailFormValues) {
    mutation.mutate({ id: circuit.id, data: values });
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
                    <Input placeholder="Nom du circuit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Description du circuit..."
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

        {/* Jours d'operation */}
        <Card>
          <CardHeader>
            <CardTitle>Jours d&apos;operation</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="operatingDays"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-wrap gap-4">
                    {DAYS.map((day) => {
                      const checked = field.value?.includes(day.value) ?? false;
                      return (
                        <label
                          key={day.value}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              const current = field.value ?? [];
                              if (c) {
                                field.onChange([...current, day.value].sort());
                              } else {
                                field.onChange(current.filter((d) => d !== day.value));
                              }
                            }}
                            className="cursor-pointer"
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      );
                    })}
                  </div>
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

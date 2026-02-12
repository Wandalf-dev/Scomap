"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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

export function CircuitCreateClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const form = useForm<CircuitDetailFormValues>({
    resolver: zodResolver(circuitDetailSchema),
    defaultValues: {
      name: "",
      description: "",
      operatingDays: [],
    },
  });

  const mutation = useMutation(
    trpc.circuits.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit cree");
        router.push(data?.id ? `/circuits/${data.id}` : "/circuits");
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  function onSubmit(values: CircuitDetailFormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/circuits")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouveau circuit
        </h1>
      </div>

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
              {mutation.isPending ? "Creation..." : "Creer le circuit"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { EtablissementSelector } from "./etablissement-selector";
import { Tag, CalendarDays, School, FileText } from "lucide-react";

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[0.5rem] bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

interface CircuitData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  etablissementId: string;
}

interface TabInformationsProps {
  circuit: CircuitData;
}

export function TabInformations({ circuit }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<CircuitDetailFormValues>({
    resolver: zodResolver(circuitDetailSchema),
    defaultValues: {
      name: circuit.name,
      etablissementId: circuit.etablissementId,
      description: circuit.description ?? "",
      startDate: circuit.startDate ?? null,
      endDate: circuit.endDate ?? null,
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
        toast.success("Circuit enregistré");
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Identification + Période côte à côte */}
        <div className="grid grid-cols-2 gap-8">
          <section className="space-y-4">
            <SectionTitle icon={Tag}>Identification</SectionTitle>
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
          </section>

          <section className="space-y-4">
            <SectionTitle icon={CalendarDays}>Période</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
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
                name="endDate"
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
          </section>
        </div>

        {/* Établissement de destination */}
        <section className="space-y-4">
          <SectionTitle icon={School}>Établissement de destination</SectionTitle>
          <FormField
            control={form.control}
            name="etablissementId"
            render={() => (
              <FormItem>
                <EtablissementSelector
                  selectedEtablissementId={
                    form.watch("etablissementId") || null
                  }
                  onSelect={(result) => {
                    form.setValue("etablissementId", result.etablissementId, {
                      shouldValidate: true,
                    });
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Description */}
        <section className="space-y-4">
          <SectionTitle icon={FileText}>Description</SectionTitle>
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
        </section>

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
  );
}

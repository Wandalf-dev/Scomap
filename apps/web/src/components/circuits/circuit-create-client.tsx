"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { ArrowLeft, Tag, CalendarDays, School, FileText } from "lucide-react";
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

export function CircuitCreateClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const form = useForm<CircuitDetailFormValues>({
    resolver: zodResolver(circuitDetailSchema),
    defaultValues: {
      name: "",
      etablissementId: "",
      description: "",
    },
  });

  const mutation = useMutation(
    trpc.circuits.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit créé");
        router.push(data?.id ? `/circuits/${data.id}` : "/circuits");
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de la création");
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
          variant="outline"
          effect="expandIcon"
          icon={ArrowLeft}
          iconPlacement="left"
          size="sm"
          onClick={() => router.push("/circuits")}
          className="cursor-pointer"
        >
          Retour
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouveau circuit
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Identification + Period side by side */}
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
            <SectionTitle icon={School}>
              Établissement de destination
            </SectionTitle>
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
                      form.setValue(
                        "etablissementId",
                        result.etablissementId,
                        { shouldValidate: true }
                      );
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
              {mutation.isPending ? "Création..." : "Créer le circuit"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

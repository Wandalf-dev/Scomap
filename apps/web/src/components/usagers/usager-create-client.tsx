"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import {
  usagerDetailSchema,
  type UsagerDetailFormValues,
} from "@/lib/validators/usager";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuestionMarkCircleIcon } from "@/components/ui/question-mark-circle-icon";

const GENDERS = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
];

function toUpperCase(value: string) {
  return value.toUpperCase();
}

function capitalize(value: string) {
  return value
    .split(/(-|\s)/)
    .map((part) =>
      part.length > 0 && part !== "-" && part !== " "
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part
    )
    .join("");
}

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
      transportStartDate: settings?.schoolYearStart ?? null,
      transportEndDate: settings?.schoolYearEnd ?? null,
      notes: "",
    },
    values: {
      code: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      etablissementId: "",
      transportStartDate: settings?.schoolYearStart ?? null,
      transportEndDate: settings?.schoolYearEnd ?? null,
      notes: "",
    },
  });

  const mutation = useMutation(
    trpc.usagers.createFull.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager créé");
        router.push(data?.id ? `/usagers/${data.id}` : "/usagers");
      },
      onError: () => {
        toast.error("Erreur lors de la création");
      },
    }),
  );

  function onSubmit(values: UsagerDetailFormValues) {
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
          onClick={() => router.push("/usagers")}
          className="cursor-pointer"
        >
          Retour
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">
          Nouvel usager
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Identité */}
          <Card>
            <CardHeader>
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nom"
                          {...field}
                          onChange={(e) => field.onChange(toUpperCase(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Prénom"
                          {...field}
                          onChange={(e) => field.onChange(capitalize(e.target.value))}
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
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de naissance</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        toYear={new Date().getFullYear()}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Genre</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value} className="cursor-pointer">
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code usager</FormLabel>
                      <FormControl>
                        <Input placeholder="Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Établissement */}
          <Card>
            <CardHeader>
              <CardTitle>Établissement</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="etablissementId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Établissement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionner un établissement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {etablissements?.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="cursor-pointer">
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Transport */}
          <Card>
            <CardHeader>
              <CardTitle>Transport</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transportStartDate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>Date début transport</FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer text-muted-foreground">
                              <QuestionMarkCircleIcon size={16} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Date de début de transport de l&apos;usager, pré-remplie
                            à partir des paramètres de l&apos;année scolaire. Elle sera
                            reprise automatiquement lors de la création d&apos;un circuit.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
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
                name="transportEndDate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>Date fin transport</FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer text-muted-foreground">
                              <QuestionMarkCircleIcon size={16} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Date de fin de transport de l&apos;usager, pré-remplie
                            à partir des paramètres de l&apos;année scolaire. Elle sera
                            reprise automatiquement lors de la création d&apos;un circuit.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      clearable
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Observations */}
          <Card>
            <CardHeader>
              <CardTitle>Observations</CardTitle>
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
              {mutation.isPending ? "Création..." : "Créer l'usager"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

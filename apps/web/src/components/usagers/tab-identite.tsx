"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  usagerDetailSchema,
  USAGER_STATUSES,
  USAGER_STATUS_LABELS,
  USAGER_REGIMES,
  USAGER_REGIME_LABELS,
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, GraduationCap, Bus, MessageSquareText } from "lucide-react";

const GENDERS = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
];

interface UsagerData {
  id: string;
  code: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  status: string;
  regime: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  secondaryEtablissementId: string | null;
  secondaryEtablissementName: string | null;
  transportStartDate: string | null;
  transportEndDate: string | null;
  transportParticularity: string | null;
  specificity: string | null;
  notes: string | null;
}

interface TabIdentiteProps {
  usager: UsagerData;
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[0.5rem] bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function TabIdentite({ usager }: TabIdentiteProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const form = useForm<UsagerDetailFormValues>({
    resolver: zodResolver(usagerDetailSchema),
    defaultValues: {
      code: usager.code ?? "",
      firstName: usager.firstName,
      lastName: usager.lastName,
      birthDate: usager.birthDate ?? "",
      gender: (usager.gender as "M" | "F" | "") ?? "",
      status: (usager.status as typeof USAGER_STATUSES[number]) ?? "brouillon",
      regime: (usager.regime as typeof USAGER_REGIMES[number] | "") ?? "",
      etablissementId: usager.etablissementId ?? "",
      secondaryEtablissementId: usager.secondaryEtablissementId ?? "",
      transportStartDate: usager.transportStartDate ?? null,
      transportEndDate: usager.transportEndDate ?? null,
      transportParticularity: usager.transportParticularity ?? "",
      specificity: usager.specificity ?? "",
      notes: usager.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.usagers.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.getById.queryKey({ id: usager.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager enregistré");
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
      },
    }),
  );

  function onSubmit(values: UsagerDetailFormValues) {
    mutation.mutate({ id: usager.id, data: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Identité */}
        <section className="space-y-4">
          <SectionTitle icon={User}>Identité</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom" {...field} />
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
                    <Input placeholder="Prénom" {...field} />
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
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
        </section>

        <Separator />

        {/* Scolarité */}
        <section className="space-y-4">
          <SectionTitle icon={GraduationCap}>Scolarité</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="etablissementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Établissement principal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Sélectionner" />
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
            <FormField
              control={form.control}
              name="secondaryEtablissementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Établissement secondaire</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Aucun" />
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
          </div>
          <FormField
            control={form.control}
            name="regime"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Régime</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger className="w-full cursor-pointer">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {USAGER_REGIMES.map((r) => (
                      <SelectItem key={r} value={r} className="cursor-pointer">
                        {USAGER_REGIME_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        {/* Transport */}
        <section className="space-y-4">
          <SectionTitle icon={Bus}>Transport</SectionTitle>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "brouillon"}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USAGER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="cursor-pointer">
                          {USAGER_STATUS_LABELS[s]}
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
              name="transportStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date début transport</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="transportEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date fin transport</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="transportParticularity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Particularité transport</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: fauteuil roulant, accompagnateur requis..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        {/* Observations */}
        <section className="space-y-4">
          <SectionTitle icon={MessageSquareText}>Observations</SectionTitle>
          <FormField
            control={form.control}
            name="specificity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spécificité (visible sur feuilles de route)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Informations visibles sur les documents de transport..."
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes internes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notes libres..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

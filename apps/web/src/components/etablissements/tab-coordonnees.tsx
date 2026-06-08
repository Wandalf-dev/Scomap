"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  etablissementDetailSchema,
  type EtablissementDetailFormValues,
} from "@/lib/validators/etablissement";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocompleteInput } from "@/components/forms/address-autocomplete-input";
import { AddressMapDialog } from "@/components/shared/address-map-dialog";
import {
  Building2,
  MapPin,
  Phone,
  UserRound,
  MessageSquareText,
} from "lucide-react";
import type { Etablissement } from "@scomap/db/schema";

function SectionHeader({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
        <Icon className="size-4" />
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {children}
      </h2>
    </div>
  );
}

const TYPES = [
  { value: "ecole", label: "École" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "autre", label: "Autre" },
];

const REGIMES = [
  { value: "public", label: "Public" },
  { value: "prive", label: "Privé" },
];

const CIVILITIES = [
  { value: "M.", label: "M." },
  { value: "Mme", label: "Mme" },
];

interface TabCoordonneesProps {
  etablissement: Etablissement;
}

export function TabCoordonnees({ etablissement }: TabCoordonneesProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "etablissement-coordonnees-form";

  const form = useForm<EtablissementDetailFormValues>({
    resolver: zodResolver(etablissementDetailSchema),
    defaultValues: {
      name: etablissement.name,
      type: etablissement.type ?? "",
      regime: etablissement.regime ?? "",
      codeUai: etablissement.codeUai ?? "",
      color: etablissement.color ?? "#0D9488",
      address: etablissement.address,
      city: etablissement.city ?? "",
      postalCode: etablissement.postalCode ?? "",
      latitude: etablissement.latitude ?? null,
      longitude: etablissement.longitude ?? null,
      phone: etablissement.phone ?? "",
      email: etablissement.email ?? "",
      website: etablissement.website ?? "",
      managerCivility: etablissement.managerCivility ?? "",
      managerName: etablissement.managerName ?? "",
      managerPhone: etablissement.managerPhone ?? "",
      managerEmail: etablissement.managerEmail ?? "",
      observations: etablissement.observations ?? "",
    },
  });

  const mutation = useMutation(
    trpc.etablissements.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.getById.queryKey({
            id: etablissement.id,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Établissement enregistré");
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/etablissements");
        }
        exitAfterSaveRef.current = false;
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  function onSubmit(values: EtablissementDetailFormValues) {
    mutation.mutate({ id: etablissement.id, data: values });
  }

  // Synchronise l'état « modifié » avec le bandeau (avertissement au retour).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("etablissement-coordonnees", isDirty);
    return () => setDirty?.("etablissement-coordonnees", false);
  }, [isDirty, setDirty]);

  return (
    <>
      {headerActions?.target &&
        createPortal(
          <>
            <Button
              type="submit"
              form={formId}
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => {
                exitAfterSaveRef.current = false;
              }}
              className="cursor-pointer"
            >
              {mutation.isPending && !exitAfterSaveRef.current
                ? "Enregistrement..."
                : "Enregistrer"}
            </Button>
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={mutation.isPending}
              onClick={() => {
                exitAfterSaveRef.current = true;
              }}
              className="cursor-pointer"
            >
              {mutation.isPending && exitAfterSaveRef.current
                ? "Enregistrement..."
                : "Enregistrer et quitter"}
            </Button>
          </>,
          headerActions.target,
        )}

      <Form {...form}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Informations générales */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={Building2}>
              Informations générales
            </SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de l'établissement" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="codeUai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code UAI</FormLabel>
                    <FormControl>
                      <Input placeholder="0000000A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem
                            key={t.value}
                            value={t.value}
                            className="cursor-pointer"
                          >
                            {t.label}
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
                name="regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Régime</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REGIMES.map((r) => (
                          <SelectItem
                            key={r.value}
                            value={r.value}
                            className="cursor-pointer"
                          >
                            {r.label}
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={field.value || "#0D9488"}
                          onChange={field.onChange}
                          className="h-9 w-12 cursor-pointer rounded-[0.3rem] border border-input p-0.5"
                        />
                        <Input
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Adresse */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <SectionHeader icon={MapPin}>Adresse</SectionHeader>
              <AddressMapDialog
                latitude={form.watch("latitude")}
                longitude={form.watch("longitude")}
                label={form.watch("name") || "Adresse"}
                buttonLabel="Voir sur la carte"
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <AddressAutocompleteInput
                      value={field.value}
                      onChange={field.onChange}
                      onSelect={(s) => {
                        form.setValue("address", s.address, {
                          shouldDirty: true,
                        });
                        form.setValue("city", s.city, { shouldDirty: true });
                        form.setValue("postalCode", s.postalCode, {
                          shouldDirty: true,
                        });
                        form.setValue("latitude", s.latitude, {
                          shouldDirty: true,
                        });
                        form.setValue("longitude", s.longitude, {
                          shouldDirty: true,
                        });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="Ville" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal</FormLabel>
                    <FormControl>
                      <Input placeholder="00000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} readOnly className="bg-muted" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} readOnly className="bg-muted" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={Phone}>Contact</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="01 23 45 67 89" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@ecole.fr"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site web</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.ecole.fr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Responsable */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={UserRound}>Responsable</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="managerCivility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civilité</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIVILITIES.map((c) => (
                          <SelectItem
                            key={c.value}
                            value={c.value}
                            className="cursor-pointer"
                          >
                            {c.label}
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
                name="managerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du responsable" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="managerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="01 23 45 67 89" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="managerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="responsable@ecole.fr"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Observations */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={MessageSquareText}>Observations</SectionHeader>
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Notes libres..." rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>
        </form>
      </Form>
    </>
  );
}

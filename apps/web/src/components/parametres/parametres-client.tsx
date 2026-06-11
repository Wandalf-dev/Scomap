"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  CalendarDays,
  Route,
  Map as MapIcon,
  Loader2,
} from "lucide-react";

const routingProviderValues = [
  "osrm",
  "ign",
  "openrouteservice",
  "google",
] as const;
const basemapProviderValues = [
  "openfreemap",
  "osm_raster",
  "maptiler",
  "ign",
] as const;

const settingsSchema = z.object({
  schoolYearStart: z.string().nullable(),
  schoolYearEnd: z.string().nullable(),
  routingProvider: z.enum(routingProviderValues),
  basemapProvider: z.enum(basemapProviderValues),
  basemapStyle: z.string().nullable(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const ROUTING_PROVIDERS: {
  value: (typeof routingProviderValues)[number];
  label: string;
  requiresKey: boolean;
  hint?: string;
}[] = [
  { value: "osrm", label: "OSRM (gratuit, mondial)", requiresKey: false },
  {
    value: "ign",
    label: "IGN Géoplateforme (gratuit, France)",
    requiresKey: false,
  },
  {
    value: "openrouteservice",
    label: "OpenRouteService (clé requise)",
    requiresKey: true,
    hint: "Clé gratuite avec quota sur openrouteservice.org.",
  },
  {
    value: "google",
    label: "Google Routes (clé requise, payant)",
    requiresKey: true,
    hint: "Activez « Routes API » et restreignez la clé par IP serveur. Facturé au-delà du palier gratuit.",
  },
];

const BASEMAP_PROVIDERS: {
  value: (typeof basemapProviderValues)[number];
  label: string;
  requiresKey: boolean;
  styles: { value: string; label: string }[];
  hint?: string;
}[] = [
  {
    value: "openfreemap",
    label: "OpenFreeMap (gratuit)",
    requiresKey: false,
    styles: [
      { value: "liberty", label: "Liberty" },
      { value: "bright", label: "Bright" },
      { value: "positron", label: "Positron" },
    ],
  },
  {
    value: "osm_raster",
    label: "Tuiles OSM (gratuit)",
    requiresKey: false,
    styles: [],
  },
  {
    value: "maptiler",
    label: "MapTiler (clé requise)",
    requiresKey: true,
    hint: "Usage commercial : plan payant requis. La clé est chiffrée et servie via un proxy (jamais exposée au navigateur).",
    styles: [
      { value: "streets-v2", label: "Streets" },
      { value: "basic-v2", label: "Basic" },
      { value: "outdoor-v2", label: "Outdoor" },
      { value: "satellite", label: "Satellite" },
      { value: "hybrid", label: "Hybride" },
    ],
  },
  {
    value: "ign",
    label: "IGN Plan / Photo (gratuit, France)",
    requiresKey: false,
    styles: [
      { value: "GEOGRAPHICALGRIDSYSTEMS.PLAN.IGN", label: "Plan IGN" },
      { value: "ORTHOIMAGERY.ORTHOPHOTOS", label: "Photo aérienne" },
    ],
  },
];

interface ParametresClientProps {
  isAdmin: boolean;
}

export function ParametresClient({ isAdmin }: ParametresClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(
    trpc.tenantSettings.get.queryOptions(),
  );

  // API keys entered by the user (write-only: never read back from the server).
  const [routingApiKey, setRoutingApiKey] = useState("");
  const [basemapApiKey, setBasemapApiKey] = useState("");

  const keyStatus = settings?.keyStatus ?? {};

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: {
      schoolYearStart: settings?.schoolYearStart ?? null,
      schoolYearEnd: settings?.schoolYearEnd ?? null,
      routingProvider: settings?.routingProvider ?? "ign",
      basemapProvider: settings?.basemapProvider ?? "openfreemap",
      basemapStyle: settings?.basemapStyle ?? null,
    },
  });

  const updateMutation = useMutation(
    trpc.tenantSettings.update.mutationOptions(),
  );
  const setKeyMutation = useMutation(
    trpc.tenantSettings.setProviderKey.mutationOptions(),
  );
  const testMutation = useMutation(
    trpc.tenantSettings.testRouting.mutationOptions(),
  );
  const setTypeMutation = useMutation(
    trpc.tenantSettings.setType.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.tenantSettings.get.queryKey(),
        });
        toast.success("Type d'organisation enregistré");
      },
      onError: (err) =>
        toastTrpcError(err, "Erreur lors de l'enregistrement du type"),
    }),
  );

  const routingProvider = form.watch("routingProvider");
  const basemapProvider = form.watch("basemapProvider");

  const routingMeta = ROUTING_PROVIDERS.find((p) => p.value === routingProvider);
  const basemapMeta = BASEMAP_PROVIDERS.find((p) => p.value === basemapProvider);
  const basemapStyles = basemapMeta?.styles ?? [];

  const isSaving = updateMutation.isPending || setKeyMutation.isPending;

  async function onSubmit(values: SettingsFormValues) {
    try {
      await updateMutation.mutateAsync(values);

      if (routingMeta?.requiresKey && routingApiKey.trim()) {
        await setKeyMutation.mutateAsync({
          category: "routing",
          provider: values.routingProvider,
          apiKey: routingApiKey.trim(),
        });
      }
      if (values.basemapProvider === "maptiler" && basemapApiKey.trim()) {
        await setKeyMutation.mutateAsync({
          category: "basemap",
          provider: "maptiler",
          apiKey: basemapApiKey.trim(),
        });
      }

      setRoutingApiKey("");
      setBasemapApiKey("");
      queryClient.invalidateQueries({
        queryKey: trpc.tenantSettings.get.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.basemap.getStyle.queryKey(),
      });
      toast.success("Paramètres enregistrés");
    } catch (err) {
      toastTrpcError(err, "Erreur lors de l'enregistrement");
    }
  }

  function handleTestRouting() {
    testMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.ok) {
          toast.success(
            `Itinéraire calculé via « ${res.providerUsed} »${
              res.distanceKm != null ? ` (${res.distanceKm} km)` : ""
            }`,
          );
        } else {
          toast.error(
            `Échec du calcul (provider « ${res.providerUsed} »). Vérifiez la clé.`,
          );
        }
      },
      onError: (err) => toastTrpcError(err, "Test indisponible"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">
            Configuration générale de votre espace
          </p>
        </div>
        <div className="h-48 animate-pulse rounded-[0.5rem] bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration générale de votre espace
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-[0.3rem] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Lecture seule — la modification de ces paramètres est réservée aux
          administrateurs.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* The server already rejects non-admin writes (adminProcedure):
              the fieldset simply aligns the UI with this rule */}
          <fieldset disabled={!isAdmin} className="space-y-6">
          {/* Organisation type */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Type d&apos;organisation</CardTitle>
              </div>
              <CardDescription>
                Profil métier de votre structure. Il adapte certains écrans,
                notamment la vue par défaut du planning (timeline pour les
                transporteurs).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings?.tenantType ?? "departement"}
                onValueChange={(v) =>
                  setTypeMutation.mutate({
                    type: v as "departement" | "transporteur",
                  })
                }
                disabled={setTypeMutation.isPending}
              >
                <SelectTrigger className="max-w-lg cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departement" className="cursor-pointer">
                    Département / Autorité organisatrice
                  </SelectItem>
                  <SelectItem value="transporteur" className="cursor-pointer">
                    Transporteur
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* School year */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle>Année scolaire</CardTitle>
              </div>
              <CardDescription>
                Définissez les dates de l&apos;année scolaire en cours. Ces dates
                seront utilisées pour pré-remplir automatiquement les dates de
                début et fin de transport lors de la création d&apos;un usager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <FormField
                  control={form.control}
                  name="schoolYearStart"
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
                  name="schoolYearEnd"
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
            </CardContent>
          </Card>

          {/* Route calculation engine */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Route className="h-5 w-5 text-primary" />
                <CardTitle>Moteur de calcul d&apos;itinéraire</CardTitle>
              </div>
              <CardDescription>
                Service utilisé pour calculer les distances, durées et tracés des
                trajets. Le repli automatique sur OSRM s&apos;applique en cas
                d&apos;indisponibilité.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 max-w-lg">
                <FormField
                  control={form.control}
                  name="routingProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fournisseur</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROUTING_PROVIDERS.map((p) => (
                            <SelectItem
                              key={p.value}
                              value={p.value}
                              className="cursor-pointer"
                            >
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {routingMeta?.requiresKey && (
                  <div className="space-y-1.5">
                    <FormLabel>Clé API</FormLabel>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={routingApiKey}
                      onChange={(e) => setRoutingApiKey(e.target.value)}
                      placeholder={
                        keyStatus[routingProvider]
                          ? `••••${keyStatus[routingProvider]} — laisser vide pour conserver`
                          : "Saisir la clé API"
                      }
                    />
                    {routingMeta.hint && (
                      <p className="text-xs text-muted-foreground">
                        {routingMeta.hint}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleTestRouting}
                disabled={testMutation.isPending}
                className="cursor-pointer"
              >
                {testMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Tester le calcul
              </Button>
            </CardContent>
          </Card>

          {/* Basemap */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-primary" />
                <CardTitle>Fond de carte</CardTitle>
              </div>
              <CardDescription>
                Style de carte affiché sur les trajets et la cartographie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 max-w-lg">
                <FormField
                  control={form.control}
                  name="basemapProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fournisseur</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          const opt = BASEMAP_PROVIDERS.find(
                            (p) => p.value === v,
                          );
                          form.setValue(
                            "basemapStyle",
                            opt?.styles[0]?.value ?? null,
                          );
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BASEMAP_PROVIDERS.map((p) => (
                            <SelectItem
                              key={p.value}
                              value={p.value}
                              className="cursor-pointer"
                            >
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {basemapStyles.length > 0 && (
                  <FormField
                    control={form.control}
                    name="basemapStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Style</FormLabel>
                        <Select
                          value={field.value ?? basemapStyles[0]?.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full cursor-pointer">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {basemapStyles.map((s) => (
                              <SelectItem
                                key={s.value}
                                value={s.value}
                                className="cursor-pointer"
                              >
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {basemapMeta?.requiresKey && (
                  <div className="space-y-1.5">
                    <FormLabel>Clé API</FormLabel>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={basemapApiKey}
                      onChange={(e) => setBasemapApiKey(e.target.value)}
                      placeholder={
                        keyStatus[basemapProvider]
                          ? `••••${keyStatus[basemapProvider]} — laisser vide pour conserver`
                          : "Saisir la clé API"
                      }
                    />
                    {basemapMeta.hint && (
                      <p className="text-xs text-muted-foreground">
                        {basemapMeta.hint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          )}
          </fieldset>
        </form>
      </Form>
    </div>
  );
}

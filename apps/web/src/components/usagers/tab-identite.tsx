"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "nextjs-toploader/app";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  usagerDetailSchema,
  USAGER_STATUSES,
  USAGER_STATUS_LABELS,
  USAGER_REGIMES,
  USAGER_REGIME_LABELS,
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
  ETABLISSEMENT_TYPE_LABELS,
  CLASSES_BY_TYPE,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, GraduationCap, Bus, MessageSquareText, Route } from "lucide-react";
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
  etablissementType: string | null;
  secondaryEtablissementId: string | null;
  secondaryEtablissementName: string | null;
  classe: string | null;
  transportType: string | null;
  distanceKm: number | null;
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
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "usager-identite-form";

  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  // Dès qu'une affectation circuit existe, les champs critiques (établissement,
  // type de transport, dates de transport) sont verrouillés : ils ne se
  // modifient plus que via un avenant — traçabilité.
  const { data: affectations } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId: usager.id }),
  );
  const affectationLocked = (affectations?.length ?? 0) > 0;

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
      classe: usager.classe ?? "",
      transportType: (usager.transportType as typeof USAGER_TRANSPORT_TYPES[number] | "") ?? "",
      distanceKm: usager.distanceKm ?? null,
      transportStartDate: usager.transportStartDate ?? "",
      transportEndDate: usager.transportEndDate ?? null,
      transportParticularity: usager.transportParticularity ?? "",
      specificity: usager.specificity ?? "",
      notes: usager.notes ?? "",
    },
  });

  const mutation = useMutation(
    trpc.usagers.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.getById.queryKey({ id: usager.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager enregistré");
        // Reset form to mark it clean (isDirty = false)
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/usagers");
        }
        exitAfterSaveRef.current = false;
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  const computeDistanceMutation = useMutation(
    trpc.usagers.computeDistance.mutationOptions({
      onSuccess: ({ km }) => {
        form.setValue("distanceKm", km, { shouldDirty: true });
        toast.success(`Distance calculée : ${km} km`);
      },
      onError: (err) => {
        toast.error(err.message || "Erreur lors du calcul de la distance");
      },
    }),
  );

  function onSubmit(values: UsagerDetailFormValues) {
    mutation.mutate({ id: usager.id, data: values });
  }

  // Sync form dirty state with the layout's unsaved-changes context.
  // On dépend de `setDirty` (stable via useCallback dans le provider) et NON de
  // l'objet `unsaved` complet : ce dernier change de référence à chaque
  // changement de `dirtyKeys`, ce qui ferait re-déclencher cet effet en boucle
  // (cleanup → false, body → true → dirtyKeys change → unsaved change → …) et
  // provoquerait "Maximum update depth exceeded".
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("usager-identite", isDirty);
    return () => setDirty?.("usager-identite", false);
  }, [isDirty, setDirty]);

  return (
    <Form {...form}>
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
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Identité + Scolarité côte à côte */}
        <div className="grid grid-cols-2 gap-5">
          {/* Identité */}
          <section className="space-y-4 rounded-[0.5rem] border border-border bg-card p-5">
            <SectionTitle icon={User}>Identité</SectionTitle>
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
            <div className="grid grid-cols-2 gap-4">
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

          {/* Scolarité */}
          <section className="space-y-4 rounded-[0.5rem] border border-border bg-card p-5">
            <SectionTitle icon={GraduationCap}>Scolarité</SectionTitle>
            <FormField
              control={form.control}
              name="etablissementId"
              render={({ field }) => {
                const selectedEtab = etablissements?.find((e) => e.id === field.value);
                const etabType = selectedEtab?.type as keyof typeof CLASSES_BY_TYPE | undefined;
                const typeLabel = etabType && ETABLISSEMENT_TYPE_LABELS[etabType];
                return (
                  <FormItem>
                    <FormLabel>
                      Établissement principal
                      {typeLabel && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({typeLabel})
                        </span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={(val) => {
                      field.onChange(val);
                      // Reset classe quand on change d'établissement
                      const newEtab = etablissements?.find((e) => e.id === val);
                      const newType = newEtab?.type as keyof typeof CLASSES_BY_TYPE | undefined;
                      const currentClasse = form.getValues("classe");
                      if (newType && currentClasse) {
                        const validClasses = CLASSES_BY_TYPE[newType]?.map((c) => c.value) ?? [];
                        if (!validClasses.includes(currentClasse)) {
                          form.setValue("classe", "");
                        }
                      }
                    }}
                      value={field.value ?? ""}
                      disabled={affectationLocked}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={`w-full ${affectationLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        >
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
                    {affectationLocked && (
                      <p className="text-xs text-muted-foreground">
                        Verrouillé (usager affecté à un circuit) — modifiable via{" "}
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/avenants/new?usagerId=${usager.id}`)
                          }
                          className="cursor-pointer font-medium underline underline-offset-2 hover:no-underline"
                        >
                          un avenant
                        </button>
                        .
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="classe"
                render={({ field }) => {
                  const selectedEtabId = form.watch("etablissementId");
                  const selectedEtab = etablissements?.find((e) => e.id === selectedEtabId);
                  const etabType = selectedEtab?.type as keyof typeof CLASSES_BY_TYPE | undefined;
                  const classes = etabType ? CLASSES_BY_TYPE[etabType] ?? [] : [];
                  return (
                    <FormItem>
                      <FormLabel>Classe</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                        disabled={classes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full cursor-pointer">
                            <SelectValue placeholder={classes.length === 0 ? "Sélectionnez un établissement" : "Sélectionner"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="regime"
                render={({ field }) => (
                  <FormItem>
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
            </div>
          </section>
        </div>

        {/* Transport */}
        <section className="space-y-4 rounded-[0.5rem] border border-border bg-card p-5">
          <SectionTitle icon={Bus}>Transport</SectionTitle>
          <div className="grid grid-cols-3 items-start gap-4">
            <FormField
              control={form.control}
              name="transportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de transport</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={affectationLocked}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={`w-full ${affectationLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USAGER_TRANSPORT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="cursor-pointer">
                          {USAGER_TRANSPORT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {affectationLocked && (
                    <p className="text-xs text-muted-foreground">
                      Verrouillé (usager affecté à un circuit) — modifiable via{" "}
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/avenants/new?usagerId=${usager.id}`)
                        }
                        className="cursor-pointer font-medium underline underline-offset-2 hover:no-underline"
                      >
                        un avenant
                      </button>
                      .
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="distanceKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance domicile → école</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        placeholder="km"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value == null ? "" : String(field.value)}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? null : Number(v));
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={computeDistanceMutation.isPending}
                      onClick={() =>
                        computeDistanceMutation.mutate({ id: usager.id })
                      }
                      title="Calculer la distance routière (adresse principale → établissement principal)"
                      className="shrink-0 cursor-pointer"
                    >
                      <Route className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="transportStartDate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1">
                    <FormLabel>
                      Date début transport
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-pointer text-muted-foreground">
                            <QuestionMarkCircleIcon size={16} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Date de début de transport de l&apos;usager, pré-remplie
                          à partir des paramètres de l&apos;année scolaire. Champ
                          obligatoire car utilisé pour générer les trajets et
                          initialiser les circuits associés.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={affectationLocked}
                  />
                  {affectationLocked && (
                    <p className="text-xs text-muted-foreground">
                      Verrouillé (usager affecté à un circuit) — modifiable via
                      avenant.
                    </p>
                  )}
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
                    disabled={affectationLocked}
                  />
                  {affectationLocked && (
                    <p className="text-xs text-muted-foreground">
                      Verrouillé (usager affecté à un circuit) — modifiable via
                      avenant.
                    </p>
                  )}
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

        {/* Observations */}
        <section className="space-y-4 rounded-[0.5rem] border border-border bg-card p-5">
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

      </form>
    </Form>
  );
}

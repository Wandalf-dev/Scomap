"use client";

import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import {
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
import {
  User,
  GraduationCap,
  Bus,
  MessageSquareText,
  Route,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuestionMarkCircleIcon } from "@/components/ui/question-mark-circle-icon";
import { FieldLock } from "@/components/shared/field-lock";
import { AddressMapDialog } from "@/components/shared/address-map-dialog";

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

/** Bouton « ouvrir la fiche établissement » (nouvel onglet), à droite d'un
 *  sélecteur. Masqué si aucun établissement n'est choisi. */
function EtabLinkButton({
  etablissementId,
}: {
  etablissementId: string | null | undefined;
}) {
  if (!etablissementId) return null;
  return (
    <Button
      type="button"
      asChild
      variant="outline"
      size="icon"
      className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      title="Ouvrir la fiche de l'établissement"
    >
      <Link
        href={`/etablissements/${etablissementId}`}
        target="_blank"
        aria-label="Ouvrir la fiche de l'établissement"
      >
        <ExternalLink className="size-4" />
      </Link>
    </Button>
  );
}

type EtabOption = {
  id: string;
  name: string;
  type: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Adresse formatée d'un établissement sur une ligne, ou null si vide. */
function formatEtabAddress(etab: EtabOption | undefined): string | null {
  if (!etab) return null;
  const line = [etab.address, [etab.postalCode, etab.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return line || null;
}

interface UsagerFormFieldsProps {
  form: UseFormReturn<UsagerDetailFormValues>;
  formId: string;
  onSubmit: (values: UsagerDetailFormValues) => void;
  etablissements?: EtabOption[];
  /** Affiché en badge dans la card Identité (édition uniquement). */
  displayId?: number;
  /** Champs critiques verrouillés (édition après affectation à un circuit). */
  affectationLocked?: boolean;
  /** Lien du cadenas FieldLock (création d'avenant). */
  avenantHref?: string;
  /** Si fourni, affiche le bouton de calcul de distance routière. */
  onComputeDistance?: () => void;
  computingDistance?: boolean;
}

/**
 * Corps de formulaire usager (Identité, Scolarité, Transport, Observations),
 * partagé entre la création (`UsagerCreateClient`) et la fiche (`TabIdentite`)
 * pour garantir un design identique. Le parent fournit le `form`, la soumission
 * et les boutons d'action ; ce composant ne rend que les champs.
 */
export function UsagerFormFields({
  form,
  formId,
  onSubmit,
  etablissements,
  displayId,
  affectationLocked = false,
  avenantHref,
  onComputeDistance,
  computingDistance = false,
}: UsagerFormFieldsProps) {
  const locked = affectationLocked && !!avenantHref;

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identité + Scolarité côte à côte */}
        <div className="grid grid-cols-2 gap-6">
          {/* Identité */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <SectionHeader icon={User}>Identité</SectionHeader>
              {displayId != null && (
                <span
                  title="Identifiant de l'usager"
                  className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary dark:bg-primary/20"
                >
                  ID&nbsp;#{displayId}
                </span>
              )}
            </div>
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
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={GraduationCap}>Scolarité</SectionHeader>
            <FormField
              control={form.control}
              name="etablissementId"
              render={({ field }) => {
                const selectedEtab = etablissements?.find((e) => e.id === field.value);
                const etabType = selectedEtab?.type as keyof typeof CLASSES_BY_TYPE | undefined;
                const typeLabel = etabType && ETABLISSEMENT_TYPE_LABELS[etabType];
                return (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>
                        Établissement principal
                        {typeLabel && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({typeLabel})
                          </span>
                        )}
                      </FormLabel>
                      {locked && <FieldLock href={avenantHref!} />}
                    </div>
                    <div className="flex items-center gap-2">
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
                        disabled={locked}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={`w-full ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
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
                      {selectedEtab && (
                        <AddressMapDialog
                          latitude={selectedEtab.latitude}
                          longitude={selectedEtab.longitude}
                          label={selectedEtab.name}
                        />
                      )}
                      <EtabLinkButton etablissementId={field.value} />
                    </div>
                    {formatEtabAddress(selectedEtab) && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3 shrink-0" />
                        {formatEtabAddress(selectedEtab)}
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
                  <div className="flex items-center gap-2">
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
                    <EtabLinkButton etablissementId={field.value} />
                  </div>
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
        <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
          <SectionHeader icon={Bus}>Transport</SectionHeader>
          <div className="grid grid-cols-3 items-start gap-4">
            <FormField
              control={form.control}
              name="transportType"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Type de transport</FormLabel>
                    {locked && <FieldLock href={avenantHref!} />}
                  </div>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value ? field.value : "__none__"}
                    disabled={locked}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={`w-full ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__" className="cursor-pointer text-muted-foreground">
                        Aucun (à définir)
                      </SelectItem>
                      {USAGER_TRANSPORT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="cursor-pointer">
                          {USAGER_TRANSPORT_TYPE_LABELS[t]}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "non_controle"}>
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
                    {onComputeDistance && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={computingDistance}
                        onClick={onComputeDistance}
                        title="Calculer la distance routière (adresse principale → établissement principal)"
                        className="shrink-0 cursor-pointer"
                      >
                        <Route className="h-4 w-4" />
                      </Button>
                    )}
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
                  <div className="flex items-center gap-1.5">
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
                    {locked && <FieldLock href={avenantHref!} />}
                  </div>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={locked}
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
                  <div className="flex items-center gap-1.5">
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
                    {locked && <FieldLock href={avenantHref!} />}
                  </div>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    clearable
                    disabled={locked}
                  />
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
        <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
          <SectionHeader icon={MessageSquareText}>Observations</SectionHeader>
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

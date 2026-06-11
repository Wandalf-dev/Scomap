"use client";

import { useRouter } from "nextjs-toploader/app";
import { Route, SquarePlus } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FORM_ID } from "./schemas";
import { CircuitPicker } from "./circuit-picker";
import { SectionCard, AddressAndOptionsSections } from "./form-sections";
import type { UseFormReturn } from "react-hook-form";
import type { LinkFormValues, CreateNewFormValues } from "./schemas";
import type { AddressItem, CircuitListItem, CircuitSuggestion } from "./types";

// Invalid submission: bring the first field in error into the viewport.
// The "Associer" button is sticky at the top, so the inline error (FormMessage,
// already in place) can be off-screen. We do not shift anything and add no UI
// element; we rely on the existing red message under the field.
function scrollToFirstError() {
  // Double rAF: let React mount the <FormMessage> elements before targeting.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const form = document.getElementById(FORM_ID);
      const message = form?.querySelector('[data-slot="form-message"]');
      const target =
        message?.closest('[data-slot="form-item"]') ?? message ?? null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }),
  );
}

// --- Edit mode (locked fields, changes go through an avenant) ---

interface AssociationEditFormProps {
  form: UseFormReturn<LinkFormValues>;
  onSubmit: (values: LinkFormValues) => void;
  circuitName: string | undefined;
  usagerId: string;
  addresses: AddressItem[];
  occupiedIds: Set<string>;
  avenantHref: string;
}

export function AssociationEditForm({
  form,
  onSubmit,
  circuitName,
  usagerId,
  addresses,
  occupiedIds,
  avenantHref,
}: AssociationEditFormProps) {
  const router = useRouter();
  return (
    <Form {...form}>
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}
        className="space-y-6"
      >
        <SectionCard icon={Route} title="Circuit">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-sm">
                Circuit : <strong>{circuitName}</strong>
              </p>
            </div>
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">Champs verrouillés</p>
              <p className="mt-0.5">
                Le circuit, les jours et l&apos;adresse de prise en
                charge se modifient via un avenant (traçabilité).
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(`/avenants/new?usagerId=${usagerId}`)
                }
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
              >
                <SquarePlus className="size-3.5" />
                Créer un avenant
              </button>
            </div>
          </div>
        </SectionCard>
        <AddressAndOptionsSections
          control={form.control}
          addresses={addresses}
          locked={true}
          occupiedIds={occupiedIds}
          avenantHref={avenantHref}
        />
      </form>
    </Form>
  );
}

// --- "Nouveau circuit" mode (create a circuit then associate) ---

interface EtablissementOption {
  id: string;
  name: string;
  city: string | null;
}

interface CircuitCreateFormProps {
  form: UseFormReturn<CreateNewFormValues>;
  onSubmit: (values: CreateNewFormValues) => void | Promise<void>;
  etablissements: EtablissementOption[] | undefined;
  addresses: AddressItem[];
  occupiedIds: Set<string>;
  avenantHref: string;
}

export function CircuitCreateForm({
  form,
  onSubmit,
  etablissements,
  addresses,
  occupiedIds,
  avenantHref,
}: CircuitCreateFormProps) {
  return (
    <Form {...form}>
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}
        className="space-y-6"
      >
        <SectionCard icon={SquarePlus} title="Créer un nouveau circuit">
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="circuitName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du circuit</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Circuit École Pasteur - Matin"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="etablissementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Établissement</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Sélectionnez un établissement" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {etablissements?.map((e) => (
                        <SelectItem
                          key={e.id}
                          value={e.id}
                          className="cursor-pointer"
                        >
                          {e.name}
                          {e.city && ` — ${e.city}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>
        <AddressAndOptionsSections
          control={form.control}
          addresses={addresses}
          locked={false}
          occupiedIds={occupiedIds}
          avenantHref={avenantHref}
        />
      </form>
    </Form>
  );
}

// --- "Circuit existant" mode (pick a circuit to associate) ---

interface CircuitLinkFormProps {
  form: UseFormReturn<LinkFormValues>;
  onSubmit: (values: LinkFormValues) => void;
  availableCircuits: CircuitListItem[];
  suggestions: CircuitSuggestion[] | undefined;
  suggestionsLoading: boolean;
  addresses: AddressItem[];
  occupiedIds: Set<string>;
  avenantHref: string;
}

export function CircuitLinkForm({
  form,
  onSubmit,
  availableCircuits,
  suggestions,
  suggestionsLoading,
  addresses,
  occupiedIds,
  avenantHref,
}: CircuitLinkFormProps) {
  return (
    <Form {...form}>
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, scrollToFirstError)}
        className="space-y-6"
      >
        <SectionCard icon={Route} title="Choisir le circuit">
          <FormField
            control={form.control}
            name="circuitId"
            render={({ field }) => (
              <FormItem>
                <CircuitPicker
                  availableCircuits={availableCircuits}
                  suggestions={suggestions}
                  suggestionsLoading={suggestionsLoading}
                  value={field.value}
                  onSelect={(id) => field.onChange(id)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>
        <AddressAndOptionsSections
          control={form.control}
          addresses={addresses}
          locked={false}
          occupiedIds={occupiedIds}
          avenantHref={avenantHref}
        />
      </form>
    </Form>
  );
}

"use client";

import NextLink from "next/link";
import { MapPin, Bell, ShieldCheck, SquarePlus } from "lucide-react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getAddressTypeLabel } from "./helpers";
import type { LucideIcon } from "lucide-react";
import type { AddressItem } from "./types";

// --- Section card ---

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// --- Address radio cards ---

/**
 * Address rank badge: position 1 = "Principale" (highlighted), the next ones
 * "Adresse 2/3/4". Convention position=1 ⇒ principale, identical to the rest
 * of the app (Adresses tab, domicile↔school distance computation).
 */
function AddressRankBadge({ position }: { position: number }) {
  const isPrimary = position === 1;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        isPrimary
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {isPrimary ? "Principale" : `Adresse ${position}`}
    </span>
  );
}

function AddressCards({
  control,
  addresses,
  locked,
  occupiedIds,
  avenantHref,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  addresses: AddressItem[];
  locked: boolean;
  occupiedIds?: Set<string>;
  avenantHref?: string;
}) {
  return (
    <FormField
      control={control}
      name="usagerAddressId"
      render={({ field }) => (
        <FormItem>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune adresse enregistrée pour cet usager.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Adresse de prise en charge"
              className={cn(
                "grid gap-2",
                locked && "pointer-events-none opacity-60",
              )}
            >
              {addresses.map((addr) => {
                const selected = field.value === addr.id;
                const label =
                  getAddressTypeLabel(addr.type) || `Adresse ${addr.position}`;
                const full = [addr.address, addr.city]
                  .filter(Boolean)
                  .join(", ");
                // Address already on a circuit (outside edit mode): not
                // selectable, we point to the avenant.
                const occupied = !locked && (occupiedIds?.has(addr.id) ?? false);

                if (occupied) {
                  return (
                    <div
                      key={addr.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <span className="mt-0.5 size-4 shrink-0 rounded-full border border-muted-foreground/30" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <AddressRankBadge position={addr.position} />
                          <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Déjà sur un circuit
                          </span>
                        </div>
                        {full && (
                          <p className="truncate text-xs text-muted-foreground">
                            {full}
                          </p>
                        )}
                        {avenantHref && (
                          <NextLink
                            href={avenantHref}
                            className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <SquarePlus className="size-3" />
                            Changer via un avenant
                          </NextLink>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    key={addr.id}
                    role="radio"
                    aria-checked={selected}
                    disabled={locked}
                    onClick={() => field.onChange(addr.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      locked ? "cursor-not-allowed" : "cursor-pointer",
                      selected
                        ? "border-primary bg-primary/[0.06] ring-1 ring-inset ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {label}
                        </span>
                        <AddressRankBadge position={addr.position} />
                      </span>
                      {full && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {full}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// --- Options toggles ---

function OptionsToggles({
  control,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      <FormField
        control={control}
        name="arrivalNotification"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Bell className="size-4" />
            </span>
            <div className="flex-1 space-y-0.5">
              <FormLabel className="text-sm">
                Notification d&apos;arrivée
              </FormLabel>
              <FormDescription className="text-xs">
                Envoyer une notification à l&apos;arrivée du véhicule
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="cursor-pointer"
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="authorizationAlone"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <div className="flex-1 space-y-0.5">
              <FormLabel className="text-sm">
                Autorisation de rentrer seul
              </FormLabel>
              <FormDescription className="text-xs">
                L&apos;usager est autorisé à rentrer seul à son domicile
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="cursor-pointer"
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

// --- Adresse + Options cards, shared by the 3 modes ---

interface AddressAndOptionsSectionsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  addresses: AddressItem[];
  locked: boolean;
  occupiedIds?: Set<string>;
  avenantHref?: string;
}

export function AddressAndOptionsSections({
  control,
  addresses,
  locked,
  occupiedIds,
  avenantHref,
}: AddressAndOptionsSectionsProps) {
  return (
    <>
      <SectionCard icon={MapPin} title="Adresse de prise en charge">
        <AddressCards
          control={control}
          addresses={addresses}
          locked={locked}
          occupiedIds={occupiedIds}
          avenantHref={avenantHref}
        />
      </SectionCard>
      <SectionCard icon={Bell} title="Options">
        <OptionsToggles control={control} />
      </SectionCard>
    </>
  );
}

"use client";

import type { UseFormReturn } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Car, FileText } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import type { VehiculeDetailFormValues } from "@/lib/validators/vehicule";

interface VehiculeFormFieldsProps {
  form: UseFormReturn<VehiculeDetailFormValues>;
  formId: string;
  onSubmit: (values: VehiculeDetailFormValues) => void;
}

/**
 * Shared vehicle identity fields — used by both the create page and the detail
 * "Informations" tab so the two never drift (mirrors ChauffeurFormFields).
 * Submit buttons live in the parent and target this form via `form={formId}`.
 */
export function VehiculeFormFields({
  form,
  formId,
  onSubmit,
}: VehiculeFormFieldsProps) {
  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Identification — all vehicle specs incl. accessibility */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
          <SectionHeader icon={Car}>Identification</SectionHeader>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input placeholder="Nom du véhicule" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="licensePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Immatriculation</FormLabel>
                  <FormControl>
                    <Input placeholder="AA-123-BB" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacité</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Nombre de places"
                      {...field}
                      value={field.value ?? ""}
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
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marque</FormLabel>
                  <FormControl>
                    <Input placeholder="Marque" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modèle</FormLabel>
                  <FormControl>
                    <Input placeholder="Modèle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Année</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="2024"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="wheelchairAccessible"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border border-border bg-muted/30 p-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="cursor-pointer"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">
                  Accessible fauteuil roulant
                </FormLabel>
              </FormItem>
            )}
          />
        </section>

        {/* Notes */}
        <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
          <SectionHeader icon={FileText}>Notes</SectionHeader>
          <FormField
            control={form.control}
            name="notes"
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
  );
}

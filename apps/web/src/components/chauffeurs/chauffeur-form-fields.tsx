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
import { DatePicker } from "@/components/ui/date-picker";
import { User, Phone, FileText } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import type { ChauffeurDetailFormValues } from "@/lib/validators/chauffeur";

interface ChauffeurFormFieldsProps {
  form: UseFormReturn<ChauffeurDetailFormValues>;
  formId: string;
  onSubmit: (values: ChauffeurDetailFormValues) => void;
}

/**
 * Shared chauffeur identity fields — used by both the create page and the
 * detail "Informations" tab so the two never drift (mirrors UsagerFormFields).
 * Submit buttons live in the parent and target this form via `form={formId}`.
 */
export function ChauffeurFormFields({
  form,
  formId,
  onSubmit,
}: ChauffeurFormFieldsProps) {
  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Identité + Coordonnées side by side */}
        <div className="grid grid-cols-2 gap-6">
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={User}>Identité</SectionHeader>
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
            <FormField
              control={form.control}
              name="hireDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d&apos;embauche</FormLabel>
                  <DatePicker
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    clearable
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={Phone}>Coordonnées</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemple.fr"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="06 12 34 56 78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adresse complète..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>
        </div>

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

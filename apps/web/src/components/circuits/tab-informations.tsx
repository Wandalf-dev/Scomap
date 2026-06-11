"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import { toastTrpcError } from "@/lib/utils/trpc-errors";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes-context";
import { useHeaderActions } from "@/components/shared/header-actions-context";
import {
  circuitDetailSchema,
  CIRCUIT_STATUSES,
  CIRCUIT_STATUS_LABELS,
  type CircuitDetailFormValues,
} from "@/lib/validators/circuit";
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { EtablissementSelector } from "./etablissement-selector";
import { Tag, CalendarDays, School, FileText, Lock } from "lucide-react";

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

interface CircuitData {
  id: string;
  name: string;
  code: string | null;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  etablissementId: string;
  /** Assigned usagers (open versions). > 0 ⇒ validity dates are locked. */
  usagerCount: number;
}

interface TabInformationsProps {
  circuit: CircuitData;
}

export function TabInformations({ circuit }: TabInformationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const headerActions = useHeaderActions();
  const exitAfterSaveRef = useRef(false);
  const formId = "circuit-informations-form";

  const form = useForm<CircuitDetailFormValues>({
    resolver: zodResolver(circuitDetailSchema),
    defaultValues: {
      name: circuit.name,
      code: circuit.code ?? "",
      status:
        (circuit.status as CircuitDetailFormValues["status"]) ?? "non_controle",
      etablissementId: circuit.etablissementId,
      description: circuit.description ?? "",
      startDate: circuit.startDate ?? null,
      endDate: circuit.endDate ?? null,
    },
  });

  const mutation = useMutation(
    trpc.circuits.updateDetail.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.getById.queryKey({ id: circuit.id }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit enregistré");
        // Reset to return the form to "clean" state (isDirty=false).
        form.reset(variables.data);
        if (exitAfterSaveRef.current) {
          router.push("/circuits");
        }
        exitAfterSaveRef.current = false;
      },
      onError: (err) => {
        toastTrpcError(err, "Erreur lors de l'enregistrement");
        exitAfterSaveRef.current = false;
      },
    }),
  );

  function onSubmit(values: CircuitDetailFormValues) {
    mutation.mutate({ id: circuit.id, data: values });
  }

  // As soon as a circuit has assigned usagers, its validity dates are locked
  // (consistency with usager transport periods — also enforced server-side in
  // updateDetail). To change them: remove all usagers first.
  const datesLocked = circuit.usagerCount > 0;

  // Syncs the "modified" state with the unsaved-changes banner (back warning).
  const isDirty = form.formState.isDirty;
  const setDirty = unsaved?.setDirty;
  useEffect(() => {
    setDirty?.("circuit-informations", isDirty);
    return () => setDirty?.("circuit-informations", false);
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
          {/* Identification + Period side by side */}
          <div className="grid grid-cols-2 gap-6">
            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={Tag}>Identification</SectionHeader>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du circuit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex. C6019"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Référence client optionnelle (partagée par les trajets).
                    </p>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "non_controle"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIRCUIT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="cursor-pointer">
                            {CIRCUIT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
              <SectionHeader icon={CalendarDays}>Période</SectionHeader>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        disabled={datesLocked}
                        clearable
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de fin</FormLabel>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        disabled={datesLocked}
                        clearable
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {datesLocked && (
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Dates figées : ce circuit a des usagers affectés. Pour les
                    modifier, retirez d&apos;abord tous les usagers du circuit.
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* Établissement de destination */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={School}>
              Établissement de destination
            </SectionHeader>
            <FormField
              control={form.control}
              name="etablissementId"
              render={() => (
                <FormItem>
                  <EtablissementSelector
                    selectedEtablissementId={
                      form.watch("etablissementId") || null
                    }
                    onSelect={(result) => {
                      form.setValue("etablissementId", result.etablissementId, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Description */}
          <section className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SectionHeader icon={FileText}>Description</SectionHeader>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Description du circuit..."
                      rows={4}
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
    </>
  );
}

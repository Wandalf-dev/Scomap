"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, School } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UsagerSelector } from "@/components/trajets/usager-selector";
import { EtablissementSelector } from "@/components/circuits/etablissement-selector";
import {
  arretSchema,
  type ArretFormValues,
} from "@/lib/validators/trajet";

interface ArretFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ArretFormValues) => void;
  defaultValues?: Partial<ArretFormValues>;
  nextOrderIndex: number;
  isPending: boolean;
  mode: "create" | "edit";
}

export function ArretFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  nextOrderIndex,
  isPending,
  mode,
}: ArretFormDialogProps) {
  const [selectedType, setSelectedType] = useState<"usager" | "etablissement">(
    (defaultValues?.type as "usager" | "etablissement") ?? "usager",
  );

  const form = useForm<ArretFormValues>({
    resolver: zodResolver(arretSchema),
    defaultValues: {
      type: "usager",
      usagerAddressId: undefined,
      etablissementId: undefined,
      name: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      orderIndex: nextOrderIndex,
      arrivalTime: "",
      waitTime: undefined,
      ...defaultValues,
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const type =
        (defaultValues?.type as "usager" | "etablissement") ?? "usager";
      setSelectedType(type);
      form.reset({
        type,
        usagerAddressId: undefined,
        etablissementId: undefined,
        name: "",
        address: "",
        latitude: undefined,
        longitude: undefined,
        orderIndex: nextOrderIndex,
        arrivalTime: "",
        waitTime: undefined,
        ...defaultValues,
      });
    }
    onOpenChange(open);
  };

  function handleTypeChange(type: "usager" | "etablissement") {
    setSelectedType(type);
    form.setValue("type", type);
    form.setValue("usagerAddressId", undefined);
    form.setValue("etablissementId", undefined);
    form.setValue("name", "");
    form.setValue("address", "");
    form.setValue("latitude", undefined);
    form.setValue("longitude", undefined);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter un arrêt" : "Modifier l'arrêt"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
            {/* Type selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedType === "usager" ? "default" : "outline"}
                onClick={() => handleTypeChange("usager")}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Usager
              </Button>
              <Button
                type="button"
                variant={
                  selectedType === "etablissement" ? "default" : "outline"
                }
                onClick={() => handleTypeChange("etablissement")}
                className="cursor-pointer"
              >
                <School className="mr-2 h-4 w-4" />
                Établissement
              </Button>
            </div>

            {/* Selector based on type */}
            {selectedType === "usager" ? (
              <UsagerSelector
                selectedUsagerAddressId={form.watch("usagerAddressId")}
                onSelect={(result) => {
                  form.setValue("usagerAddressId", result.usagerAddressId);
                  form.setValue("etablissementId", undefined);
                  form.setValue("name", result.usagerName);
                  form.setValue("address", result.address);
                  form.setValue("latitude", result.latitude ?? undefined);
                  form.setValue("longitude", result.longitude ?? undefined);
                }}
              />
            ) : (
              <EtablissementSelector
                selectedEtablissementId={form.watch("etablissementId")}
                onSelect={(result) => {
                  form.setValue("etablissementId", result.etablissementId);
                  form.setValue("usagerAddressId", undefined);
                  form.setValue("name", result.name);
                  form.setValue("address", result.address);
                  form.setValue("latitude", result.latitude ?? undefined);
                  form.setValue("longitude", result.longitude ?? undefined);
                }}
              />
            )}

            {/* Auto-filled fields (read-only) */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nom de l'arrêt"
                      className="bg-muted"
                      readOnly
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Adresse"
                      className="bg-muted"
                      readOnly
                      value={field.value ?? ""}
                      onChange={() => {}}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="arrivalTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure d&apos;arrivée</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waitTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attente (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(
                            v === "" ? undefined : parseInt(v, 10),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="cursor-pointer"
              >
                {isPending
                  ? "Enregistrement..."
                  : mode === "create"
                    ? "Ajouter"
                    : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

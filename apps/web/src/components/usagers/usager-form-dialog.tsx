"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  usagerSchema,
  type UsagerFormValues,
} from "@/lib/validators/usager";

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

interface UsagerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UsagerFormValues) => void;
  defaultValues?: UsagerFormValues;
  isPending: boolean;
  mode: "create" | "edit";
}

export function UsagerFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  mode,
}: UsagerFormDialogProps) {
  const trpc = useTRPC();
  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const form = useForm<UsagerFormValues>({
    resolver: zodResolver(usagerSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      etablissementId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        defaultValues ?? {
          firstName: "",
          lastName: "",
          birthDate: "",
          gender: "",
          etablissementId: "",
        },
      );
    }
  }, [open, defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Ajouter un usager"
              : "Modifier l'usager"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 pt-2"
          >
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="etablissementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Établissement</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
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
                  <FormMessage />
                </FormItem>
              )}
            />

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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  etablissementContactSchema,
  type EtablissementContactFormValues,
} from "@/lib/validators/etablissement-contact";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import type { EtablissementContact } from "@scomap/db/schema";

const CIVILITIES = [
  { value: "M.", label: "M." },
  { value: "Mme", label: "Mme" },
];

interface TabInterlocuteursProps {
  etablissementId: string;
}

export function TabInterlocuteurs({ etablissementId }: TabInterlocuteursProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EtablissementContact | null>(null);
  const [deleteContact, setDeleteContact] = useState<EtablissementContact | null>(null);

  const { data: contacts, isLoading } = useQuery(
    trpc.etablissementContacts.list.queryOptions({ etablissementId }),
  );

  const createMutation = useMutation(
    trpc.etablissementContacts.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissementContacts.list.queryKey({ etablissementId }),
        });
        toast.success("Interlocuteur ajouté");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de l'ajout");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.etablissementContacts.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissementContacts.list.queryKey({ etablissementId }),
        });
        toast.success("Interlocuteur modifié");
        setFormOpen(false);
        setEditingContact(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.etablissementContacts.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissementContacts.list.queryKey({ etablissementId }),
        });
        toast.success("Interlocuteur supprimé");
        setDeleteContact(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  function handleCreate() {
    setEditingContact(null);
    setFormOpen(true);
  }

  function handleEdit(contact: EtablissementContact) {
    setEditingContact(contact);
    setFormOpen(true);
  }

  function handleFormSubmit(values: EtablissementContactFormValues) {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: values });
    } else {
      createMutation.mutate({ etablissementId, data: values });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {!contacts || contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun interlocuteur
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un premier interlocuteur pour cet établissement.
          </p>
        </div>
      ) : (
        <div className="rounded-[0.3rem] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Civilité</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>{contact.civility ?? "—"}</TableCell>
                  <TableCell className="font-medium">{contact.lastName}</TableCell>
                  <TableCell>{contact.firstName ?? "—"}</TableCell>
                  <TableCell>{contact.function ?? "—"}</TableCell>
                  <TableCell>{contact.phone ?? "—"}</TableCell>
                  <TableCell>{contact.email ?? "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEdit(contact)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteContact(contact)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingContact(null);
        }}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingContact
            ? {
                civility: editingContact.civility ?? "",
                lastName: editingContact.lastName,
                firstName: editingContact.firstName ?? "",
                function: editingContact.function ?? "",
                phone: editingContact.phone ?? "",
                email: editingContact.email ?? "",
                observations: editingContact.observations ?? "",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={editingContact ? "edit" : "create"}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteContact}
        onOpenChange={(open) => !open && setDeleteContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;interlocuteur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>{deleteContact?.firstName} {deleteContact?.lastName}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContact && deleteMutation.mutate({ id: deleteContact.id })}
              disabled={deleteMutation.isPending}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Contact Form Dialog ---

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EtablissementContactFormValues) => void;
  defaultValues?: EtablissementContactFormValues;
  isPending: boolean;
  mode: "create" | "edit";
}

function ContactFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isPending,
  mode,
}: ContactFormDialogProps) {
  const form = useForm<EtablissementContactFormValues>({
    resolver: zodResolver(etablissementContactSchema),
    defaultValues: defaultValues ?? {
      civility: "",
      lastName: "",
      firstName: "",
      function: "",
      phone: "",
      email: "",
      observations: "",
    },
  });

  // Reset when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      form.reset(
        defaultValues ?? {
          civility: "",
          lastName: "",
          firstName: "",
          function: "",
          phone: "",
          email: "",
          observations: "",
        },
      );
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ajouter un interlocuteur" : "Modifier l'interlocuteur"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 pt-2">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="civility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civilité</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIVILITIES.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                            {c.label}
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
              name="function"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fonction</FormLabel>
                  <FormControl>
                    <Input placeholder="Directeur, Secrétaire..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="01 23 45 67 89" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemple.fr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observations</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notes..." rows={3} {...field} />
                  </FormControl>
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
              <Button type="submit" disabled={isPending} className="cursor-pointer">
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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import {
  userCreateSchema,
  USER_ROLES,
  USER_ROLE_LABELS,
  type UserCreateFormValues,
} from "@/lib/validators/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users as UsersIcon, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";

// Mot de passe provisoire lisible (sans caractères ambigus I/l/O/0)
function generatePassword(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (b) => charset[b % charset.length]!).join("");
}

interface UsersCardProps {
  currentUserId: string;
}

export function UsersCard({ currentUserId }: UsersCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: usersList, isLoading } = useQuery(trpc.users.list.queryOptions());

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });

  const createMutation = useMutation(trpc.users.create.mutationOptions());
  const updateRoleMutation = useMutation(trpc.users.updateRole.mutationOptions());
  const deleteMutation = useMutation(trpc.users.delete.mutationOptions());

  const form = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "user",
      password: "",
    },
  });

  async function onCreate(values: UserCreateFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast.success(
        "Compte créé. Transmettez le mot de passe provisoire à l'utilisateur.",
      );
      setDialogOpen(false);
      form.reset();
      invalidateList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    }
  }

  function handleRoleChange(id: string, role: (typeof USER_ROLES)[number]) {
    updateRoleMutation.mutate(
      { id, role },
      {
        onSuccess: () => {
          toast.success("Rôle mis à jour");
          invalidateList();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Compte supprimé");
          invalidateList();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              <CardTitle>Utilisateurs</CardTitle>
            </div>
            <CardDescription>
              Comptes ayant accès à cet espace. Créez un compte avec un mot de
              passe provisoire et transmettez-le à l&apos;utilisateur — il
              pourra le changer depuis le menu « Mon compte ».
            </CardDescription>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un utilisateur</DialogTitle>
                <DialogDescription>
                  Le compte est créé immédiatement avec le mot de passe
                  provisoire ci-dessous.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onCreate)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <Input placeholder="Jean" {...field} />
                          </FormControl>
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
                            <Input placeholder="Dupont" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="nom@exemple.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full cursor-pointer">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {USER_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="cursor-pointer">
                                {USER_ROLE_LABELS[r]}
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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe provisoire</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              autoComplete="off"
                              placeholder="Minimum 12 caractères"
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() =>
                              form.setValue("password", generatePassword(), {
                                shouldValidate: true,
                              })
                            }
                          >
                            <RefreshCw className="h-4 w-4" />
                            Générer
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="cursor-pointer"
                    >
                      {createMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Créer le compte
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[0.3rem] bg-muted" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersList ?? []).map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name ?? "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (vous)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) =>
                          handleRoleChange(u.id, v as (typeof USER_ROLES)[number])
                        }
                        disabled={isSelf || updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-40 cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="cursor-pointer">
                              {USER_ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isSelf || deleteMutation.isPending}
                            className="cursor-pointer text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Supprimer ce compte ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {u.name ?? u.email} perdra immédiatement l&apos;accès
                              à cet espace. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="cursor-pointer">
                              Annuler
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(u.id)}
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  User,
  ShieldCheck,
  Palette,
  Building2,
  Sun,
  Moon,
  Monitor,
  BadgeCheck,
  MailWarning,
  CalendarDays,
  Globe,
  Loader2,
  Check,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "@/components/ui/sonner";
import {
  userProfileUpdateSchema,
  USER_ROLE_LABELS,
  type UserProfileUpdateFormValues,
} from "@/lib/validators/user";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { radiusOptions } from "@/config/theme-customizer-constants";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CompteClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery(trpc.users.me.queryOptions());

  if (isLoading || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-[0.5rem]" />
        <Skeleton className="h-10 w-80 rounded-[0.5rem]" />
        <Skeleton className="h-64 w-full rounded-[0.5rem]" />
      </div>
    );
  }

  const initial = (me.name?.trim()?.[0] ?? me.email[0] ?? "?").toUpperCase();
  const verified = me.emailVerifiedAt != null;

  return (
    <div className="space-y-6">
      {/* En-tête héro : identité d'un coup d'œil */}
      <div className="flex flex-col gap-4 rounded-[0.5rem] border border-border bg-card p-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {me.name ?? "Utilisateur"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{me.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{USER_ROLE_LABELS[me.role]}</Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                verified
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/40 text-amber-700 dark:text-amber-400",
              )}
            >
              {verified ? (
                <BadgeCheck className="h-3.5 w-3.5" />
              ) : (
                <MailWarning className="h-3.5 w-3.5" />
              )}
              {verified ? "Email vérifié" : "Email non vérifié"}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {me.tenantName}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profil" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profil" className="cursor-pointer gap-1.5">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="securite" className="cursor-pointer gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="apparence" className="cursor-pointer gap-1.5">
            <Palette className="h-4 w-4" />
            Apparence
          </TabsTrigger>
          <TabsTrigger value="organisation" className="cursor-pointer gap-1.5">
            <Building2 className="h-4 w-4" />
            Organisation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <ProfilTab
            name={me.name ?? ""}
            email={me.email}
            createdAt={me.createdAt}
            onSaved={() =>
              queryClient.invalidateQueries({
                queryKey: trpc.users.me.queryKey(),
              })
            }
          />
        </TabsContent>

        <TabsContent value="securite">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Mot de passe</CardTitle>
              </div>
              <CardDescription>
                Choisissez un mot de passe d&apos;au moins 12 caractères, unique
                à cette application.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg">
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apparence">
          <ApparenceTab />
        </TabsContent>

        <TabsContent value="organisation">
          <OrganisationTab
            name={me.tenantName}
            slug={me.tenantSlug}
            description={me.tenantDescription}
            createdAt={me.tenantCreatedAt}
            role={USER_ROLE_LABELS[me.role]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfilTab({
  name,
  email,
  createdAt,
  onSaved,
}: {
  name: string;
  email: string;
  createdAt: string | Date;
  onSaved: () => void;
}) {
  const trpc = useTRPC();
  const updateMutation = useMutation(trpc.users.updateProfile.mutationOptions());

  const form = useForm<UserProfileUpdateFormValues>({
    resolver: zodResolver(userProfileUpdateSchema),
    values: { name },
  });

  async function onSubmit(values: UserProfileUpdateFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success("Profil mis à jour");
      onSaved();
      form.reset(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <CardTitle>Informations personnelles</CardTitle>
        </div>
        <CardDescription>
          Votre nom est visible par les autres membres de l&apos;organisation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid max-w-lg gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Adresse email</Label>
              <Input value={email} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                L&apos;email sert d&apos;identifiant de connexion et ne peut pas
                être modifié ici.
              </p>
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Membre depuis le {formatDate(createdAt)}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateMutation.isPending || !form.formState.isDirty}
                className="cursor-pointer"
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ApparenceTab() {
  const { theme, setTheme } = useTheme();
  const { radius, updateRadius, savePreferences, isSaving, hasUnsavedChanges } =
    useSidebarConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>Apparence</CardTitle>
        </div>
        <CardDescription>
          Personnalisez le thème et l&apos;arrondi de l&apos;interface. Ces
          préférences vous sont propres.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Thème */}
        <div className="space-y-2">
          <Label>Thème</Label>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            {THEME_OPTIONS.map((opt) => {
              const active = mounted && theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-[0.5rem] border p-4 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Rayon des coins */}
        <div className="space-y-2">
          <Label>Arrondi des coins</Label>
          <div className="flex flex-wrap gap-2">
            {radiusOptions.map((opt) => {
              const active = radius === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateRadius(opt.value)}
                  className={cn(
                    "flex h-10 min-w-14 cursor-pointer items-center justify-center gap-1 rounded-[0.5rem] border px-3 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {opt.name}
                </button>
              );
            })}
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                savePreferences();
                toast.success("Préférences enregistrées");
              }}
              disabled={isSaving}
              className="cursor-pointer"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer les préférences
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrganisationTab({
  name,
  slug,
  description,
  createdAt,
  role,
}: {
  name: string;
  slug: string;
  description: string | null;
  createdAt: string | Date;
  role: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Mon organisation</CardTitle>
        </div>
        <CardDescription>
          Informations sur l&apos;espace auquel vous appartenez. Leur
          modification est réservée aux administrateurs.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:max-w-lg">
        <div className="grid gap-1">
          <Label className="text-muted-foreground">Nom</Label>
          <p className="text-sm font-medium text-foreground">{name}</p>
        </div>

        <div className="grid gap-1">
          <Label className="text-muted-foreground">Sous-domaine</Label>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {slug}
          </p>
        </div>

        {description && (
          <div className="grid gap-1">
            <Label className="text-muted-foreground">Description</Label>
            <p className="text-sm text-foreground">{description}</p>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Créée le {formatDate(createdAt)}
          </span>
          <span className="text-sm text-muted-foreground">
            Votre rôle : <Badge variant="secondary">{role}</Badge>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

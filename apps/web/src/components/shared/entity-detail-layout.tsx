"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  UnsavedChangesProvider,
  useUnsavedChanges,
} from "@/components/shared/unsaved-changes-context";
import {
  HeaderActionsProvider,
  useHeaderActions,
} from "@/components/shared/header-actions-context";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface EntityDetailLayoutProps {
  isLoading: boolean;
  entity: unknown | undefined;
  backHref: string;
  entityName: string;
  title: string;
  badges?: React.ReactNode;
  onDelete: () => void;
  isDeleting: boolean;
  deleteEntityName: string;
  deleteLabel: string;
  tabs: Tab[];
  /** Onglet initial (ex. depuis ?tab=...). Ignoré s'il ne correspond à aucun onglet. */
  defaultTab?: string;
}

function HeaderActionsSlot() {
  const ctx = useHeaderActions();
  return <div ref={ctx?.setTarget} className="flex items-center gap-2" />;
}

function BackButton({ backHref }: { backHref: string }) {
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleClick() {
    if (unsaved?.isDirty) {
      setConfirmOpen(true);
    } else {
      router.push(backHref);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non enregistrées. Si vous quittez
              maintenant, elles seront perdues. Voulez-vous vraiment continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Rester sur la page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.push(backHref)}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Quitter sans enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function EntityDetailLayout(props: EntityDetailLayoutProps) {
  return (
    <UnsavedChangesProvider>
      <HeaderActionsProvider>
        <EntityDetailLayoutInner {...props} />
      </HeaderActionsProvider>
    </UnsavedChangesProvider>
  );
}

function EntityDetailLayoutInner({
  isLoading,
  entity,
  backHref,
  entityName,
  title,
  badges,
  onDelete,
  isDeleting,
  deleteEntityName,
  deleteLabel,
  tabs,
  defaultTab,
}: EntityDetailLayoutProps) {
  const router = useRouter();
  const activeDefault =
    defaultTab && tabs.some((t) => t.value === defaultTab)
      ? defaultTab
      : tabs[0]?.value;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(backHref)}
          className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Button>
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">{entityName} introuvable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — bandeau collant qui respire, divider pleine largeur */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
        {/* Identité */}
        <div className="flex min-w-0 items-center gap-3">
          <BackButton backHref={backHref} />
          <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badges}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer {deleteEntityName}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Etes-vous sur de vouloir supprimer{" "}
                  <strong>{deleteLabel}</strong> ? Cette action est irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isDeleting}
                  className="cursor-pointer"
                >
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <HeaderActionsSlot />
        </div>
      </div>

      {/* Tabs — contrôle segmenté soigné */}
      <Tabs defaultValue={activeDefault}>
        <TabsList className="h-9 gap-1 rounded-lg border border-border bg-muted/60 p-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer rounded-md px-3.5 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/30 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

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
        variant="outline"
        effect="expandIcon"
        icon={ArrowLeft}
        iconPlacement="left"
        size="sm"
        onClick={handleClick}
        className="cursor-pointer"
      >
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
}: EntityDetailLayoutProps) {
  const router = useRouter();

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
          variant="outline"
          effect="expandIcon"
          icon={ArrowLeft}
          iconPlacement="left"
          onClick={() => router.push(backHref)}
          className="cursor-pointer"
        >
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-muted-foreground/25 p-12 text-center">
          <p className="text-muted-foreground">{entityName} non trouve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton backHref={backHref} />
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {badges}
          <HeaderActionsSlot />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              effect="expandIcon"
              icon={Trash2}
              iconPlacement="right"
              size="sm"
              className="cursor-pointer"
            >
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue={tabs[0]?.value}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer"
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

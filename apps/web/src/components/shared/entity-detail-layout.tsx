"use client";

import { useRouter } from "next/navigation";
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

export function EntityDetailLayout({
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
          variant="ghost"
          onClick={() => router.push(backHref)}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">{entityName} non trouve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(backHref)}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {badges}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
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

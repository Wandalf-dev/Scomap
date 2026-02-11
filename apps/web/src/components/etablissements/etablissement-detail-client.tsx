"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TabCoordonnees } from "./tab-coordonnees";
import { TabHoraires } from "./tab-horaires";
import { TabInterlocuteurs } from "./tab-interlocuteurs";

const TYPE_LABELS: Record<string, string> = {
  ecole: "École",
  college: "Collège",
  lycee: "Lycée",
  autre: "Autre",
};

interface EtablissementDetailClientProps {
  id: string;
}

export function EtablissementDetailClient({ id }: EtablissementDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: etablissement, isLoading } = useQuery(
    trpc.etablissements.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.etablissements.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Établissement supprimé");
        router.push("/etablissements");
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

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

  if (!etablissement) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/etablissements")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Établissement non trouvé.</p>
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
            onClick={() => router.push("/etablissements")}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {etablissement.name}
          </h1>
          {etablissement.type && (
            <Badge variant="secondary">
              {TYPE_LABELS[etablissement.type] ?? etablissement.type}
            </Badge>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l&apos;établissement</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer <strong>{etablissement.name}</strong> ?
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate({ id: etablissement.id })}
                disabled={deleteMutation.isPending}
                className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="coordonnees">
        <TabsList>
          <TabsTrigger value="coordonnees" className="cursor-pointer">
            Coordonnées
          </TabsTrigger>
          <TabsTrigger value="horaires" className="cursor-pointer">
            Horaires
          </TabsTrigger>
          <TabsTrigger value="interlocuteurs" className="cursor-pointer">
            Interlocuteurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coordonnees" className="mt-6">
          <TabCoordonnees etablissement={etablissement} />
        </TabsContent>

        <TabsContent value="horaires" className="mt-6">
          <TabHoraires etablissement={etablissement} />
        </TabsContent>

        <TabsContent value="interlocuteurs" className="mt-6">
          <TabInterlocuteurs etablissementId={etablissement.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

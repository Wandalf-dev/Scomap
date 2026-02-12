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
import { TabInformations } from "./tab-informations";
import { TabDocuments } from "./tab-documents";

interface ChauffeurDetailClientProps {
  id: string;
}

export function ChauffeurDetailClient({ id }: ChauffeurDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: chauffeur, isLoading } = useQuery(
    trpc.chauffeurs.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.chauffeurs.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.chauffeurs.list.queryKey(),
        });
        toast.success("Chauffeur supprime");
        router.push("/chauffeurs");
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

  if (!chauffeur) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/chauffeurs")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Chauffeur non trouve.</p>
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
            onClick={() => router.push("/chauffeurs")}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {chauffeur.firstName} {chauffeur.lastName}
          </h1>
          <Badge variant={chauffeur.isActive ? "default" : "secondary"} className={chauffeur.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
            {chauffeur.isActive ? "Actif" : "Inactif"}
          </Badge>
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
              <AlertDialogTitle>Supprimer le chauffeur</AlertDialogTitle>
              <AlertDialogDescription>
                Etes-vous sur de vouloir supprimer <strong>{chauffeur.firstName} {chauffeur.lastName}</strong> ?
                Cette action est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate({ id: chauffeur.id })}
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
      <Tabs defaultValue="informations">
        <TabsList>
          <TabsTrigger value="informations" className="cursor-pointer">
            Informations
          </TabsTrigger>
          <TabsTrigger value="documents" className="cursor-pointer">
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="mt-6">
          <TabInformations chauffeur={chauffeur} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <TabDocuments chauffeur={chauffeur} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

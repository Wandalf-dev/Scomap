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
import { TabMaintenance } from "./tab-maintenance";

interface VehiculeDetailClientProps {
  id: string;
}

export function VehiculeDetailClient({ id }: VehiculeDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: vehicule, isLoading } = useQuery(
    trpc.vehicules.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.vehicules.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule supprime");
        router.push("/vehicules");
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

  if (!vehicule) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/vehicules")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Vehicule non trouve.</p>
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
            onClick={() => router.push("/vehicules")}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {vehicule.name}
          </h1>
          <Badge variant={vehicule.isActive ? "default" : "secondary"} className={vehicule.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
            {vehicule.isActive ? "Actif" : "Inactif"}
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
              <AlertDialogTitle>Supprimer le vehicule</AlertDialogTitle>
              <AlertDialogDescription>
                Etes-vous sur de vouloir supprimer <strong>{vehicule.name}</strong> ?
                Cette action est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate({ id: vehicule.id })}
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
          <TabsTrigger value="maintenance" className="cursor-pointer">
            Maintenance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="mt-6">
          <TabInformations vehicule={vehicule} />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <TabMaintenance vehicule={vehicule} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

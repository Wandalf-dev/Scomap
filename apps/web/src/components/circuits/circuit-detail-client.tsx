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
import { TabArrets } from "./tab-arrets";

interface CircuitDetailClientProps {
  id: string;
}

export function CircuitDetailClient({ id }: CircuitDetailClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: circuit, isLoading } = useQuery(
    trpc.circuits.getById.queryOptions({ id }),
  );

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprime");
        router.push("/circuits");
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

  if (!circuit) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/circuits")}
          className="cursor-pointer"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="rounded-[0.3rem] border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Circuit non trouve.</p>
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
            onClick={() => router.push("/circuits")}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {circuit.name}
          </h1>
          <Badge variant={circuit.isActive ? "default" : "secondary"} className={circuit.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
            {circuit.isActive ? "Actif" : "Inactif"}
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
              <AlertDialogTitle>Supprimer le circuit</AlertDialogTitle>
              <AlertDialogDescription>
                Etes-vous sur de vouloir supprimer <strong>{circuit.name}</strong> ?
                Cette action est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} className="cursor-pointer">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate({ id: circuit.id })}
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
          <TabsTrigger value="arrets" className="cursor-pointer">
            Arrets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="mt-6">
          <TabInformations circuit={circuit} />
        </TabsContent>

        <TabsContent value="arrets" className="mt-6">
          <TabArrets circuitId={circuit.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

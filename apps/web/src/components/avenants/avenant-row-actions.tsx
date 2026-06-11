"use client";

import { Button } from "@/components/ui/button";
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
import { X, Trash2 } from "lucide-react";

/** "Cancel" button for a real avenant (X) with confirmation. Pure presentation:
 *  the mutation is owned by the parent via `onConfirm`. */
export function CancelAvenantButton({
  label,
  onConfirm,
  pending,
}: {
  label: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
          aria-label="Annuler l'avenant"
        >
          <X className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler l&apos;avenant n°{label}</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;avenant est retiré de l&apos;historique actif et son
            versioning de trajets annulé (les trajets recréés sont supprimés et
            les anciens rouverts).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            Retour
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Annuler l&apos;avenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "Delete initial composition" button (avenant 0). Disabled while real avenants
 *  exist (they depend on this base). Confirmed otherwise: the action dissociates
 *  all usagers from the circuit. */
export function DeleteCompositionButton({
  onConfirm,
  pending,
  disabled,
}: {
  onConfirm: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className="size-8 text-muted-foreground/40"
        title="Annulez d'abord les autres avenants du circuit"
        aria-label="Supprimer la composition initiale (indisponible)"
      >
        <Trash2 className="size-4" />
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
          aria-label="Supprimer la composition initiale"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer la composition initiale ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tous les usagers de ce circuit en seront dissociés et leurs arrêts
            retirés. Le circuit lui-même n&apos;est pas supprimé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            Retour
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Dissocier tous les usagers
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

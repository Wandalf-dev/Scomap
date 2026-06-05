import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TrajetEtatBadgeProps {
  /** État stocké (pour le cas « suspendu »). */
  etat?: string | null;
  /** Distance/route calculée (totalDistanceKm renseigné). */
  hasKm: boolean;
  /** Horaires de prise en charge calculés (tous les arrêts ont une heure). */
  hasTimes: boolean;
}

/**
 * État de calcul d'un trajet, explicite : un trajet doit être « OK » (distance
 * ET horaires calculés) pour être exploitable (ex. facturation).
 */
export function getTrajetEtat({
  etat,
  hasKm,
  hasTimes,
}: TrajetEtatBadgeProps): { label: string; className: string } {
  const AMBER =
    "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400";
  if (etat === "suspendu") {
    return {
      label: "Suspendu",
      className: "border-border text-muted-foreground",
    };
  }
  if (hasKm && hasTimes) {
    return {
      label: "OK",
      className:
        "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
    };
  }
  if (!hasKm && !hasTimes) {
    return {
      label: "Km/horaires non calculés",
      className:
        "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
    };
  }
  if (!hasKm) {
    return { label: "Km non calculé", className: AMBER };
  }
  return { label: "Horaires non calculés", className: AMBER };
}

export function TrajetEtatBadge(props: TrajetEtatBadgeProps) {
  const { label, className } = getTrajetEtat(props);
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", className)}>
      {label}
    </Badge>
  );
}

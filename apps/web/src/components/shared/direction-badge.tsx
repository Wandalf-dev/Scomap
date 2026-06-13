import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DirectionBadgeProps {
  direction: string;
  className?: string;
}

export function DirectionBadge({ direction, className }: DirectionBadgeProps) {
  const isAller = direction === "aller";
  return (
    <Badge
      variant="outline"
      className={cn(
        isAller
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
          : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
        className,
      )}
    >
      {isAller ? "Aller" : "Retour"}
    </Badge>
  );
}

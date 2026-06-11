"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STATUS_DOTS } from "./types";

interface OccurrenceCardProps {
  trajetName: string;
  direction: string;
  departureTime: string | null;
  status: string;
  chauffeurName: string | null;
  isCustomized?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export function OccurrenceCard({
  trajetName,
  direction,
  departureTime,
  status,
  chauffeurName,
  isCustomized,
  onClick,
  onDoubleClick,
}: OccurrenceCardProps) {
  const isAller = direction === "aller";

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`w-full rounded-[0.3rem] border px-2 py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-accent/50 ${
        isAller
          ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            STATUS_DOTS[status] ?? STATUS_DOTS.planifie
          }`}
        />
        {departureTime && (
          <span className="font-mono font-medium shrink-0">
            {departureTime}
          </span>
        )}
        <span className="truncate font-medium">{trajetName}</span>
        {isCustomized && <CustomizedIndicator />}
      </div>
      {chauffeurName && (
        <div className="mt-0.5 truncate text-muted-foreground pl-3">
          {chauffeurName}
        </div>
      )}
    </button>
  );
}

/** Small amber indicator "Personnalisé pour ce jour" (one-off override). */
export function CustomizedIndicator() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto shrink-0">
            <SlidersHorizontal className="size-3 text-amber-600 dark:text-amber-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">Personnalisé pour ce jour</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

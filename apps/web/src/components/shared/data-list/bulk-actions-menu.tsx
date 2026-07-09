"use client";

import { ChevronDown, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogInIcon } from "@/components/ui/log-in-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import type { BulkAction } from "./types";

interface BulkActionsMenuProps {
  selectionCount: number;
  selectedIds: Set<string>;
  bulkActions?: BulkAction[];
  hasBulkDelete: boolean;
  onBulkDeleteOpen: () => void;
  onClearSelection: () => void;
}

/**
 * Persistent "Actions" menu in the header (next to Exporter). Always clickable;
 * triggering an action without a selection shows an info toast instead of
 * running it.
 */
export function BulkActionsMenu({
  selectionCount,
  selectedIds,
  bulkActions,
  hasBulkDelete,
  onBulkDeleteOpen,
  onClearSelection,
}: BulkActionsMenuProps) {
  // This list has no bulk capability at all → nothing to show.
  if (!bulkActions?.length && !hasBulkDelete) return null;

  const hasSelection = selectionCount > 0;

  // Guards an action that needs a selection: informs the user when empty.
  function withSelection(run: () => void) {
    if (selectionCount === 0) {
      toast.info("Sélectionnez au moins une ligne pour effectuer cette action.");
      return;
    }
    run();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <LogInIcon size={16} className="mr-2" />
          Actions
          {hasSelection && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
              {selectionCount}
            </span>
          )}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {bulkActions?.map((action) => (
          <div key={action.label}>
            {action.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className={cn(
                "cursor-pointer",
                action.variant === "destructive" &&
                  "text-destructive focus:text-destructive",
              )}
              onClick={() =>
                withSelection(() => {
                  action.onClick(Array.from(selectedIds));
                  onClearSelection();
                })
              }
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
        {hasBulkDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => withSelection(onBulkDeleteOpen)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer{hasSelection ? ` (${selectionCount})` : ""}
            </DropdownMenuItem>
          </>
        )}
        {hasSelection && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={onClearSelection}
            >
              <X className="mr-2 h-4 w-4" />
              Désélectionner
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

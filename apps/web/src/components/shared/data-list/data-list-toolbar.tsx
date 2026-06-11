"use client";

import { useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CloudDownloadIcon,
  type CloudDownloadIconHandle,
} from "@/components/ui/cloud-download-icon";
import { DeleteIcon } from "@/components/ui/delete-icon";
import {
  DownloadIcon,
  type DownloadIconHandle,
} from "@/components/ui/download-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogInIcon } from "@/components/ui/log-in-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnPicker } from "./column-picker";
import { PAGE_SIZE_OPTIONS, getPageNumbers } from "./pagination";

import type { DragEndEvent } from "@dnd-kit/core";
import type { BulkAction } from "./types";

interface DataListToolbarProps {
  storageKey?: string;
  totalColumnCount: number;
  visibleColumnCount: number;
  orderedColumns: Array<{ key: string; header: string }>;
  columnOrder: string[];
  hiddenColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
  onColumnDragEnd: (event: DragEndEvent) => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  selectionCount: number;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onExport: (scope: "page" | "all") => void;
  totalPages: number;
  safePage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  bulkActions?: BulkAction[];
  hasBulkDelete: boolean;
  onBulkDeleteOpen: () => void;
}

export function DataListToolbar({
  storageKey,
  totalColumnCount,
  visibleColumnCount,
  orderedColumns,
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onResetColumns,
  onColumnDragEnd,
  hasActiveFilters,
  filteredCount,
  totalCount,
  onClearFilters,
  selectionCount,
  selectedIds,
  onClearSelection,
  onExport,
  totalPages,
  safePage,
  setCurrentPage,
  pageSize,
  setPageSize,
  bulkActions,
  hasBulkDelete,
  onBulkDeleteOpen,
}: DataListToolbarProps) {
  const exportPageIconRef = useRef<DownloadIconHandle>(null);
  const exportAllIconRef = useRef<CloudDownloadIconHandle>(null);

  return (
    <div className="flex items-center gap-3">
      {storageKey && (
        <ColumnPicker
          storageKey={storageKey}
          totalColumnCount={totalColumnCount}
          visibleColumnCount={visibleColumnCount}
          orderedColumns={orderedColumns}
          columnOrder={columnOrder}
          hiddenColumns={hiddenColumns}
          onToggleColumn={onToggleColumn}
          onReset={onResetColumns}
          onDragEnd={onColumnDragEnd}
        />
      )}

      {hasActiveFilters && (
        <>
          <span className="text-sm text-muted-foreground">
            {filteredCount} sur {totalCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Tout effacer
          </Button>
        </>
      )}

      {/* Export buttons */}
      <div className="h-4 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => onExport("page")}
            onMouseEnter={() => exportPageIconRef.current?.startAnimation()}
            onMouseLeave={() => exportPageIconRef.current?.stopAnimation()}
          >
            <DownloadIcon ref={exportPageIconRef} size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {selectionCount > 0
            ? `Exporter la sélection (${selectionCount})`
            : "Exporter la page courante"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => onExport("all")}
            onMouseEnter={() => exportAllIconRef.current?.startAnimation()}
            onMouseLeave={() => exportAllIconRef.current?.stopAnimation()}
          >
            <CloudDownloadIcon ref={exportAllIconRef} size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Exporter tout ({filteredCount})
        </TooltipContent>
      </Tooltip>

      {/* Inline pagination */}
      {totalPages > 1 && (
        <>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            disabled={safePage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {getPageNumbers(safePage, totalPages).map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1 text-sm text-muted-foreground select-none"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === safePage ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 cursor-pointer tabular-nums"
                onClick={() => setCurrentPage(p)}
                aria-current={p === safePage ? "page" : undefined}
              >
                {p + 1}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            disabled={safePage >= totalPages - 1}
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
            }
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Bulk actions */}
      {selectionCount > 0 && (hasBulkDelete || !!bulkActions?.length) && (
        <>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">
            {selectionCount} sélectionné{selectionCount > 1 ? "s" : ""}
          </span>
          {!!bulkActions?.length && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="cursor-pointer">
                  <LogInIcon size={16} className="mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {bulkActions.map((action) => (
                  <div key={action.label}>
                    {action.separator && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      className={`cursor-pointer ${
                        action.variant === "destructive"
                          ? "text-destructive focus:text-destructive"
                          : ""
                      }`}
                      onClick={() => {
                        action.onClick(Array.from(selectedIds));
                        onClearSelection();
                      }}
                    >
                      <action.icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDeleteOpen}
              className="cursor-pointer"
            >
              <DeleteIcon size={16} className="mr-2" />
              Supprimer
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="h-8 cursor-pointer px-2"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Désélectionner
          </Button>
        </>
      )}

      {/* Total + page size, pushed to the right */}
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        <span>{filteredCount} enregistrement{filteredCount > 1 ? "s" : ""}</span>
        <span className="text-muted-foreground/40">|</span>
        <span>Par page :</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setCurrentPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-[84px] cursor-pointer text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)} className="cursor-pointer">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

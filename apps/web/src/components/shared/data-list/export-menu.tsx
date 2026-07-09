"use client";

import { Check, ChevronDown, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  pageCount: number;
  filteredCount: number;
  selectionCount: number;
  hasActiveFilters: boolean;
  onExport: (scope: "page" | "all" | "selection") => void;
}

/** Header "Exporter" menu — scope-aware xlsx export (page / all / selection). */
export function ExportMenu({
  pageCount,
  filteredCount,
  selectionCount,
  hasActiveFilters,
  onExport,
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          Exporter
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Export XLSX
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onExport("page")}
          className="cursor-pointer"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Page courante ({pageCount})
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onExport("all")}
          className="cursor-pointer"
        >
          <Download className="mr-2 h-4 w-4" />
          Tout {hasActiveFilters ? "(filtré) " : ""}({filteredCount})
        </DropdownMenuItem>
        {selectionCount > 0 && (
          <DropdownMenuItem
            onClick={() => onExport("selection")}
            className="cursor-pointer"
          >
            <Check className="mr-2 h-4 w-4" />
            Sélection ({selectionCount})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

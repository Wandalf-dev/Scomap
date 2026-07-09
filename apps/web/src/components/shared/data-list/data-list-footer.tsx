"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS, getPageNumbers } from "./pagination";

interface PageNavProps {
  safePage: number;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

/** Page navigation (prev / numbers / next). Rendered in the LEFT toolbar
 *  cluster, right after the column picker. */
export function DataListPageNav({
  safePage,
  totalPages,
  setCurrentPage,
}: PageNavProps) {
  const inactiveClass =
    "h-7 w-7 cursor-pointer rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm dark:hover:bg-accent";

  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5 dark:bg-muted/20">
      <Button
        variant="ghost"
        size="icon"
        className={inactiveClass}
        disabled={safePage === 0}
        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
        aria-label="Page précédente"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      {getPageNumbers(safePage, totalPages).map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="flex h-7 w-5 items-center justify-center text-xs text-muted-foreground select-none"
          >
            …
          </span>
        ) : (
          <Button
            key={p}
            variant="ghost"
            size="icon"
            className={
              p === safePage
                ? "h-7 w-7 cursor-pointer rounded-md bg-primary text-xs font-semibold text-primary-foreground shadow-sm tabular-nums hover:bg-primary/90 hover:text-primary-foreground"
                : `${inactiveClass} text-xs font-medium tabular-nums`
            }
            onClick={() => setCurrentPage(p)}
            aria-current={p === safePage ? "page" : undefined}
          >
            {p + 1}
          </Button>
        ),
      )}
      <Button
        variant="ghost"
        size="icon"
        className={inactiveClass}
        disabled={safePage >= totalPages - 1}
        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
        aria-label="Page suivante"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface PageMetaProps {
  filteredCount: number;
  safePage: number;
  pageSize: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setPageSize: (size: number) => void;
}

/** Record range ("1–50 sur 101") + page-size selector. Rendered at the far
 *  RIGHT of the toolbar. */
export function DataListPageMeta({
  filteredCount,
  safePage,
  pageSize,
  setCurrentPage,
  setPageSize,
}: PageMetaProps) {
  const from = filteredCount === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(filteredCount, (safePage + 1) * pageSize);

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="whitespace-nowrap tabular-nums">
        {filteredCount === 0 ? "0" : `${from}–${to}`} sur {filteredCount}
      </span>

      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap">Par page :</span>
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
              <SelectItem
                key={size}
                value={String(size)}
                className="cursor-pointer"
              >
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

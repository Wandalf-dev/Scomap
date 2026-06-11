"use client";

import { X, Calendar as CalendarIcon } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FilterConfig } from "./types";

interface InlineColumnFilterProps {
  config: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}

export function InlineColumnFilter({
  config,
  value,
  onChange,
}: InlineColumnFilterProps) {
  const active = config.type === "select" ? value !== "" && value !== "all" : !!value;

  if (config.type === "daterange") {
    // Value encoded as "from|to" (each ISO yyyy-MM-dd, possibly empty).
    const [from = "", to = ""] = value.split("|");
    const setRange = (f: string, t: string) =>
      onChange(f || t ? `${f}|${t}` : "");
    const fmt = (iso: string) => {
      if (!iso) return null;
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    };
    const summary =
      from && to
        ? `${fmt(from)} → ${fmt(to)}`
        : from
          ? `dès ${fmt(from)}`
          : to
            ? `jusqu'au ${fmt(to)}`
            : (config.placeholder ?? "Période…");
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex h-7 w-full cursor-pointer items-center justify-between gap-1 rounded-[0.3rem] border bg-input-bg pl-2.5 text-left text-xs font-normal transition-colors ${
                active ? "pr-7" : "pr-2.5"
              } ${
                active
                  ? "border-primary/50 text-foreground"
                  : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <span className="truncate">{summary}</span>
              {/* Calendar icon only when inactive: otherwise it gives way to the clear cross */}
              {!active && <CalendarIcon className="size-3.5 shrink-0 opacity-60" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3" align="start">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Du</span>
              <DatePicker
                value={from || null}
                onChange={(v) => setRange(v ?? "", to)}
                clearable
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Au</span>
              <DatePicker
                value={to || null}
                onChange={(v) => setRange(from, v ?? "")}
                clearable
              />
            </div>
          </PopoverContent>
        </Popover>
        {active && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label={`Effacer le filtre ${config.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  if (config.type === "date") {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <DatePicker
          value={value || null}
          onChange={(v) => onChange(v ?? "")}
          clearable
          placeholder={config.placeholder ?? "jj/mm/aaaa"}
          className={`[&_input]:h-7 [&_input]:text-xs [&_input]:font-normal ${
            active ? "[&_input]:border-primary/50" : ""
          }`}
        />
      </div>
    );
  }

  if (config.type === "select") {
    return (
      <Select value={value || "all"} onValueChange={onChange}>
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          className={`h-7 w-full cursor-pointer text-xs font-normal ${
            active ? "border-primary/50 text-foreground" : "text-muted-foreground"
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {config.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* pr-7 permanently reserved: the cross appearing no longer shifts the
          text (otherwise the content "jumps" on the first typed character). */}
      <Input
        placeholder={config.placeholder ?? "Filtrer…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={`Filtrer par ${config.label}`}
        // pl-2/pr-6 (instead of the default px-3 + pr-7): on a narrow column,
        // the default padding ate the whole text area → invisible input.
        className={`h-7 w-full pl-2 pr-6 text-xs font-normal ${active ? "border-primary/50" : ""}`}
      />
      <button
        type="button"
        onClick={() => onChange("")}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-opacity hover:text-foreground ${
          active ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label={`Effacer le filtre ${config.label}`}
        tabIndex={active ? 0 : -1}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

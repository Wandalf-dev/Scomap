"use client";

import { useEffect, useState } from "react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  fromYear?: number;
  toYear?: number;
}

const DISPLAY = "dd/MM/yyyy";

// ISO (yyyy-MM-dd) -> "jj/mm/aaaa" pour l'affichage dans l'input.
function isoToDisplay(iso?: string | null): string {
  if (!iso) return "";
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? format(d, DISPLAY) : "";
}

// Masque progressif : on garde les chiffres et on insère les "/" (jj/mm/aaaa).
function maskTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "jj/mm/aaaa",
  disabled,
  className,
  clearable,
  fromYear = 1950,
  toYear = new Date().getFullYear() + 10,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>(() => isoToDisplay(value));

  // Resynchronise l'input quand la valeur change de l'extérieur
  // (reset du formulaire, sélection via le calendrier).
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const validDate = date && isValid(date) ? date : undefined;

  // Valide et remonte la saisie (au blur / Entrée).
  function commit(raw: string) {
    const t = raw.trim();
    if (t === "") {
      onChange?.(null);
      return;
    }
    const parsed = parse(t, DISPLAY, new Date());
    if (isValid(parsed)) {
      onChange?.(format(parsed, "yyyy-MM-dd"));
    } else {
      // Saisie invalide : on revient au dernier état valide.
      setText(isoToDisplay(value));
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        value={text}
        onChange={(e) => setText(maskTyping(e.target.value))}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        className={cn("pr-9", clearable && validDate && "pr-14")}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
        {clearable && validDate && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(null)}
            className="flex h-6 w-6 items-center justify-center rounded-[0.3rem] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Effacer la date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex h-6 w-6 items-center justify-center rounded-[0.3rem] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Ouvrir le calendrier"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={fr}
              selected={validDate}
              onSelect={(day) => {
                if (day) {
                  onChange?.(format(day, "yyyy-MM-dd"));
                } else {
                  onChange?.(null);
                }
                setOpen(false);
              }}
              captionLayout="dropdown"
              formatters={{
                formatMonthDropdown: (date) =>
                  date.toLocaleString("fr-FR", { month: "short" }),
              }}
              defaultMonth={validDate}
              startMonth={new Date(fromYear, 0)}
              endMonth={new Date(toYear, 11)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

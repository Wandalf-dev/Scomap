"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  useAddressAutocomplete,
  type AddressSuggestion,
} from "@/hooks/use-address-autocomplete";

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher une adresse...",
  disabled,
}: AddressAutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const { suggestions, isLoading, clear } = useAddressAutocomplete(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(suggestion: AddressSuggestion) {
    onSelect(suggestion);
    setOpen(false);
    clear();
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-[0.3rem] border border-border bg-popover shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-[0.3rem] last:rounded-b-[0.3rem]"
              onClick={() => handleSelect(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

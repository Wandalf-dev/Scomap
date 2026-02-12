"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, Bus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehiculeSelectorProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
}

export function VehiculeSelector({ value, onChange }: VehiculeSelectorProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: vehiculesList } = useQuery(
    trpc.vehicules.list.queryOptions(),
  );

  const selected = vehiculesList?.find((v) => v.id === value);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between cursor-pointer"
          >
            {selected ? (
              <span className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-muted-foreground" />
                {selected.name}
                {selected.licensePlate && (
                  <span className="text-muted-foreground">
                    ({selected.licensePlate})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Selectionner un vehicule...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Rechercher un vehicule..." />
            <CommandList>
              <CommandEmpty>Aucun vehicule trouve.</CommandEmpty>
              <CommandGroup>
                {vehiculesList?.map((vehicule) => (
                  <CommandItem
                    key={vehicule.id}
                    value={`${vehicule.name} ${vehicule.licensePlate ?? ""}`}
                    onSelect={() => {
                      onChange(vehicule.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === vehicule.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{vehicule.name}</span>
                      {vehicule.licensePlate && (
                        <span className="text-sm text-muted-foreground">
                          {vehicule.licensePlate}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          className="cursor-pointer shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

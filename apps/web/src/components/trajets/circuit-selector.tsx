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
import { ChevronsUpDown, Check, Route } from "lucide-react";
import { cn } from "@/lib/utils";

interface CircuitSelectorProps {
  value: string | null | undefined;
  onChange: (id: string) => void;
}

export function CircuitSelector({ value, onChange }: CircuitSelectorProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: circuitsList } = useQuery(
    trpc.circuits.list.queryOptions(),
  );

  const selected = circuitsList?.find((c) => c.id === value);

  return (
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
              <Route className="h-4 w-4 text-muted-foreground" />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Selectionner un circuit...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un circuit..." />
          <CommandList>
            <CommandEmpty>Aucun circuit trouve.</CommandEmpty>
            <CommandGroup>
              {circuitsList?.map((circuit) => (
                <CommandItem
                  key={circuit.id}
                  value={circuit.name}
                  onSelect={() => {
                    onChange(circuit.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === circuit.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">{circuit.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
import { ChevronsUpDown, Check, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChauffeurSelectorProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
}

export function ChauffeurSelector({ value, onChange }: ChauffeurSelectorProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: chauffeursList } = useQuery(
    trpc.chauffeurs.list.queryOptions(),
  );

  const selected = chauffeursList?.find((c) => c.id === value);

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
                <User className="h-4 w-4 text-muted-foreground" />
                {selected.firstName} {selected.lastName}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Selectionner un chauffeur...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Rechercher un chauffeur..." />
            <CommandList>
              <CommandEmpty>Aucun chauffeur trouve.</CommandEmpty>
              <CommandGroup>
                {chauffeursList?.map((chauffeur) => (
                  <CommandItem
                    key={chauffeur.id}
                    value={`${chauffeur.firstName} ${chauffeur.lastName}`}
                    onSelect={() => {
                      onChange(chauffeur.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === chauffeur.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium">
                      {chauffeur.firstName} {chauffeur.lastName}
                    </span>
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

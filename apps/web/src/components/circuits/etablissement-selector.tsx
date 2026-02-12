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
import { ChevronsUpDown, Check, School } from "lucide-react";
import { cn } from "@/lib/utils";

interface EtablissementSelectorResult {
  etablissementId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface EtablissementSelectorProps {
  onSelect: (result: EtablissementSelectorResult) => void;
  selectedEtablissementId?: string | null;
}

export function EtablissementSelector({
  onSelect,
  selectedEtablissementId,
}: EtablissementSelectorProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: etablissementsList } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const selected = etablissementsList?.find(
    (e) => e.id === selectedEtablissementId,
  );

  return (
    <div>
      <label className="text-sm font-medium">Etablissement</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="mt-1 w-full justify-between cursor-pointer"
          >
            {selected ? (
              <span className="flex items-center gap-2">
                <School className="h-4 w-4 text-muted-foreground" />
                {selected.name}
                {selected.city && (
                  <span className="text-muted-foreground">
                    ({selected.city})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Rechercher un etablissement...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Nom ou ville..." />
            <CommandList>
              <CommandEmpty>Aucun etablissement trouve.</CommandEmpty>
              <CommandGroup>
                {etablissementsList?.map((etab) => (
                  <CommandItem
                    key={etab.id}
                    value={`${etab.name} ${etab.city ?? ""} ${etab.address}`}
                    onSelect={() => {
                      onSelect({
                        etablissementId: etab.id,
                        name: etab.name,
                        address: [etab.address, etab.postalCode, etab.city]
                          .filter(Boolean)
                          .join(", "),
                        latitude: etab.latitude ?? null,
                        longitude: etab.longitude ?? null,
                      });
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedEtablissementId === etab.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{etab.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {[etab.address, etab.city]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

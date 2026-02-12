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
import { ChevronsUpDown, Check, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsagerSelectorResult {
  usagerAddressId: string;
  usagerName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface UsagerSelectorProps {
  onSelect: (result: UsagerSelectorResult) => void;
  selectedUsagerAddressId?: string | null;
}

export function UsagerSelector({
  onSelect,
  selectedUsagerAddressId,
}: UsagerSelectorProps) {
  const trpc = useTRPC();
  const [usagerOpen, setUsagerOpen] = useState(false);
  const [selectedUsagerId, setSelectedUsagerId] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);

  const { data: usagersList } = useQuery(trpc.usagers.list.queryOptions());
  const { data: addressesList } = useQuery(
    trpc.usagerAddresses.list.queryOptions(
      { usagerId: selectedUsagerId! },
      { enabled: !!selectedUsagerId },
    ),
  );

  const selectedUsager = usagersList?.find((u) => u.id === selectedUsagerId);

  return (
    <div className="space-y-3">
      {/* Step 1: Select usager */}
      <div>
        <label className="text-sm font-medium">Usager</label>
        <Popover open={usagerOpen} onOpenChange={setUsagerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={usagerOpen}
              className="mt-1 w-full justify-between cursor-pointer"
            >
              {selectedUsager ? (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selectedUsager.firstName} {selectedUsager.lastName}
                  {selectedUsager.code && (
                    <span className="text-muted-foreground">
                      ({selectedUsager.code})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Rechercher un usager...
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Nom, prenom ou code..." />
              <CommandList>
                <CommandEmpty>Aucun usager trouve.</CommandEmpty>
                <CommandGroup>
                  {usagersList?.map((usager) => (
                    <CommandItem
                      key={usager.id}
                      value={`${usager.firstName} ${usager.lastName} ${usager.code ?? ""}`}
                      onSelect={() => {
                        setSelectedUsagerId(usager.id);
                        setUsagerOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedUsagerId === usager.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div>
                        <span className="font-medium">
                          {usager.firstName} {usager.lastName}
                        </span>
                        {usager.code && (
                          <span className="ml-2 text-muted-foreground text-sm">
                            {usager.code}
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
      </div>

      {/* Step 2: Select address */}
      {selectedUsagerId && (
        <div>
          <label className="text-sm font-medium">Adresse</label>
          {!addressesList || addressesList.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Aucune adresse enregistree pour cet usager.
            </p>
          ) : (
            <Popover open={addressOpen} onOpenChange={setAddressOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={addressOpen}
                  className="mt-1 w-full justify-between cursor-pointer"
                >
                  {selectedUsagerAddressId ? (
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {addressesList.find(
                        (a) => a.id === selectedUsagerAddressId,
                      )?.label ??
                        `Adresse ${addressesList.find((a) => a.id === selectedUsagerAddressId)?.position}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Selectionner une adresse...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {addressesList.map((addr) => (
                        <CommandItem
                          key={addr.id}
                          value={`${addr.label ?? ""} ${addr.address ?? ""} ${addr.city ?? ""}`}
                          onSelect={() => {
                            onSelect({
                              usagerAddressId: addr.id,
                              usagerName: `${selectedUsager?.firstName ?? ""} ${selectedUsager?.lastName ?? ""}`,
                              address: [addr.address, addr.postalCode, addr.city]
                                .filter(Boolean)
                                .join(", "),
                              latitude: addr.latitude,
                              longitude: addr.longitude,
                            });
                            setAddressOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUsagerAddressId === addr.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {addr.label ?? `Adresse ${addr.position}`}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {[addr.address, addr.city]
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
          )}
        </div>
      )}
    </div>
  );
}

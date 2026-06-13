"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsagerSelector } from "@/components/trajets/usager-selector";
import { EtablissementSelector } from "@/components/circuits/etablissement-selector";
import { AddressAutocompleteInput } from "@/components/forms/address-autocomplete-input";
import { User, School, MapPin } from "lucide-react";
import type { OccurrenceArretAddValues } from "@/lib/validators/trajet";

type StopKind = "usager" | "etablissement" | "libre";

interface OccurrenceAddStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OccurrenceArretAddValues) => void;
  isPending: boolean;
}

const KIND_OPTIONS: { value: StopKind; label: string; icon: typeof User }[] = [
  { value: "usager", label: "Usager", icon: User },
  { value: "etablissement", label: "Établissement", icon: School },
  { value: "libre", label: "Adresse libre", icon: MapPin },
];

/**
 * "Ajout d'un point" for a single occurrence (legacy Transcolaire modal):
 * pick a usager (with one of their addresses), an établissement, or a free
 * geocoded address — added to that day only.
 */
export function OccurrenceAddStopDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: OccurrenceAddStopDialogProps) {
  const [kind, setKind] = useState<StopKind>("usager");
  const [usagerAddressId, setUsagerAddressId] = useState<string | null>(null);
  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [arrivalTime, setArrivalTime] = useState("");

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setKind("usager");
      setUsagerAddressId(null);
      setEtablissementId(null);
      setName("");
      setAddress("");
      setLatitude(null);
      setLongitude(null);
      setArrivalTime("");
    }
  }, [open]);

  function changeKind(next: StopKind) {
    setKind(next);
    setUsagerAddressId(null);
    setEtablissementId(null);
    setName("");
    setAddress("");
    setLatitude(null);
    setLongitude(null);
  }

  const isValid =
    kind === "usager"
      ? !!usagerAddressId
      : kind === "etablissement"
        ? !!etablissementId
        : name.trim().length > 0;

  function handleSubmit() {
    if (!isValid) return;
    onSubmit({
      type: kind,
      usagerAddressId: kind === "usager" ? usagerAddressId : null,
      etablissementId: kind === "etablissement" ? etablissementId : null,
      name: name.trim(),
      address,
      latitude,
      longitude,
      arrivalTime: arrivalTime || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Ajout d&apos;un point</DialogTitle>
          <DialogDescription>
            Le point est ajouté à ce trajet pour ce jour uniquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Kind switch */}
          <div className="flex items-center gap-2">
            {KIND_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={kind === opt.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => changeKind(opt.value)}
                className="flex-1 cursor-pointer"
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </Button>
            ))}
          </div>

          {kind === "usager" && (
            <UsagerSelector
              selectedUsagerAddressId={usagerAddressId}
              onSelect={(res) => {
                setUsagerAddressId(res.usagerAddressId);
                setName(res.usagerName);
                setAddress(res.address);
                setLatitude(res.latitude);
                setLongitude(res.longitude);
              }}
            />
          )}

          {kind === "etablissement" && (
            <EtablissementSelector
              selectedEtablissementId={etablissementId}
              onSelect={(res) => {
                setEtablissementId(res.etablissementId);
                setName(res.name);
                setAddress(res.address);
                setLatitude(res.latitude);
                setLongitude(res.longitude);
              }}
            />
          )}

          {kind === "libre" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nom du point</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Point de rassemblement mairie"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <AddressAutocompleteInput
                  value={address}
                  onChange={setAddress}
                  onSelect={(s) => {
                    setAddress(s.label);
                    setLatitude(s.latitude);
                    setLongitude(s.longitude);
                  }}
                />
              </div>
            </div>
          )}

          {/* Selected point recap */}
          {(kind !== "libre" && name) && (
            <div className="rounded-[0.3rem] border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{name}</span>
              {address && (
                <span className="block text-xs text-muted-foreground">
                  {address}
                </span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Horaire (optionnel)</Label>
            <Input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-36"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="cursor-pointer"
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              className="cursor-pointer"
            >
              {isPending ? "Ajout..." : "Ajouter le point"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

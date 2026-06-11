"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, PencilLine, Trash2, Phone, Mail, UserCheck, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddressMapDialog } from "@/components/shared/address-map-dialog";
import { DayPecGrid, type OccupiedDay } from "@/components/shared/day-pec-grid";
import type { DayEntry } from "@/lib/types/day-entry";
import type { UsagerAddress } from "@scomap/db/schema";

interface SortableAddressCardProps {
  addr: UsagerAddress & { daysAller: DayEntry[]; daysRetour: DayEntry[] };
  positionLabel: string;
  typeLabel: string;
  occupiedAller: OccupiedDay[];
  occupiedRetour: OccupiedDay[];
  onEdit: (addr: UsagerAddress) => void;
  onDelete: (addr: UsagerAddress) => void;
  currentAller: DayEntry[];
  currentRetour: DayEntry[];
  onDaysChange: (addr: UsagerAddress, aller: DayEntry[], retour: DayEntry[]) => void;
  canDrag: boolean;
  daysReadOnly: boolean;
  lockHref: string;
}

export function SortableAddressCard({
  addr,
  positionLabel,
  typeLabel,
  occupiedAller,
  occupiedRetour,
  onEdit,
  onDelete,
  currentAller,
  currentRetour,
  onDaysChange,
  canDrag,
  daysReadOnly,
  lockHref,
}: SortableAddressCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: addr.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style} className="gap-4 rounded-2xl border-border shadow-xs">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        {canDrag && (
          <button
            type="button"
            className="-ml-1 cursor-grab touch-none text-muted-foreground/45 transition-colors hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </button>
        )}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <MapPin className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CardTitle className="text-base font-bold tracking-tight">
            {positionLabel}
          </CardTitle>
          {typeLabel && (
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {typeLabel}
            </span>
          )}
          {addr.responsibleLastName && (
            <span className="text-sm text-muted-foreground">
              — {addr.civility} {addr.responsibleFirstName} {addr.responsibleLastName}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          <AddressMapDialog
            latitude={addr.latitude}
            longitude={addr.longitude}
            label={addr.address || positionLabel}
            variant="ghost"
            triggerClassName="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(addr)}
          >
            <PencilLine className="size-4" />
            <span className="sr-only">Modifier</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg text-destructive hover:text-destructive"
            onClick={() => onDelete(addr)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Supprimer</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2.5 text-sm">
          {addr.address && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {addr.address}
                {addr.postalCode || addr.city
                  ? ` — ${[addr.postalCode, addr.city].filter(Boolean).join(" ")}`
                  : ""}
              </span>
            </div>
          )}
          {(addr.phone || addr.mobile || addr.secondaryPhone || addr.secondaryMobile) && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {[addr.phone, addr.mobile, addr.secondaryPhone, addr.secondaryMobile].filter(Boolean).join(" / ")}
              </span>
            </div>
          )}
          {addr.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span>{addr.email}</span>
            </div>
          )}
          {addr.authorizedPerson && (
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 shrink-0 text-muted-foreground" />
              <span>Personne autorisée : {addr.authorizedPerson}</span>
            </div>
          )}
          {addr.observations && (
            <p className="text-muted-foreground italic">
              {addr.observations}
            </p>
          )}
        </div>

        {/* PEC days inline below the address */}
        <div className="mt-4 border-t border-border pt-4">
          <DayPecGrid
            daysAller={currentAller}
            daysRetour={currentRetour}
            occupiedAller={occupiedAller}
            occupiedRetour={occupiedRetour}
            onChange={(aller, retour) => onDaysChange(addr, aller, retour)}
            readOnly={daysReadOnly}
            lockHref={lockHref}
          />
        </div>
      </CardContent>
    </Card>
  );
}

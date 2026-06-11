"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  MapPin,
  User,
  School,
  GripVertical,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArretTimeInput } from "./arret-time-input";
import {
  isEtablissement,
  formatDuration,
  formatKm,
  formatGps,
} from "./arret-helpers";
import type { ArretRow } from "./types";

interface SortableArretRowProps {
  arret: ArretRow;
  position: number;
  onEdit: (arret: ArretRow) => void;
  onDelete: (arret: ArretRow) => void;
  onToggleLock: (arret: ArretRow) => void;
  onSetTime: (arret: ArretRow, time: string | null) => void;
}

export function SortableArretRow({
  arret,
  position,
  onEdit,
  onDelete,
  onToggleLock,
  onSetTime,
}: SortableArretRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: arret.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const ecole = isEtablissement(arret);

  return (
    <TableRow ref={setNodeRef} style={style} className="group">
      <TableCell className="px-1 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-7 w-6 items-center justify-center cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-foreground"
          aria-label="Réordonner l'arrêt"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-center font-mono text-sm text-muted-foreground">
        {String(position).padStart(2, "0")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {arret.type === "usager" ? (
            <User className="h-4 w-4 shrink-0 text-amber-600" />
          ) : arret.type === "etablissement" ? (
            <School className="h-4 w-4 shrink-0 text-blue-600" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            {arret.type === "usager" && arret.usagerId ? (
              <Link
                href={`/usagers/${arret.usagerId}`}
                className="font-medium text-sm text-primary hover:underline cursor-pointer"
              >
                {arret.name}
              </Link>
            ) : arret.type === "etablissement" && arret.etablissementId ? (
              <Link
                href={`/etablissements/${arret.etablissementId}`}
                className="font-medium text-sm text-primary hover:underline cursor-pointer"
              >
                {arret.name}
              </Link>
            ) : (
              <span className="font-medium text-sm">{arret.name}</span>
            )}
            {arret.address && (
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {arret.address}
              </p>
            )}
          </div>
          {ecole && (
            <Badge
              variant="outline"
              className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 text-xs shrink-0"
            >
              École
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <ArretTimeInput
          value={arret.arrivalTime}
          locked={arret.timeLocked}
          onCommit={(t) => onSetTime(arret, t)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={arret.timeLocked}
          onCheckedChange={() => onToggleLock(arret)}
          className="cursor-pointer"
          title="Verrouiller cet horaire : ignoré lors du calcul des horaires"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatKm(arret.distanceKm)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {formatDuration(arret.durationSeconds)}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatGps(arret.latitude, arret.longitude)}
      </TableCell>
      <TableCell>
        {!ecole && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onEdit(arret)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(arret)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

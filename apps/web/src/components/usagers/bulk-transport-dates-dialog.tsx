"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface BulkDatesValues {
  transportStartDate?: string | null;
  transportEndDate?: string | null;
}

interface BulkTransportDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isPending?: boolean;
  onSubmit: (values: BulkDatesValues) => void;
}

export function BulkTransportDatesDialog({
  open,
  onOpenChange,
  count,
  isPending,
  onSubmit,
}: BulkTransportDatesDialogProps) {
  // Une case par date : on n'envoie que les champs cochés (les autres restent
  // inchangés). Cochée + champ vide = on vide la date pour la sélection.
  const [editStart, setEditStart] = useState(false);
  const [editEnd, setEditEnd] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // Remise à zéro à chaque réouverture.
  useEffect(() => {
    if (open) {
      setEditStart(false);
      setEditEnd(false);
      setStart(null);
      setEnd(null);
    }
  }, [open]);

  const invalidRange = Boolean(
    editStart && editEnd && start && end && start > end,
  );
  const canSubmit = (editStart || editEnd) && !invalidRange && !isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      ...(editStart ? { transportStartDate: start } : {}),
      ...(editEnd ? { transportEndDate: end } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            Modifier les dates de transport
          </DialogTitle>
          <DialogDescription>
            {count} usager{count > 1 ? "s" : ""} sélectionné
            {count > 1 ? "s" : ""}. Cochez la ou les dates à appliquer ; les
            champs non cochés restent inchangés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-start"
                checked={editStart}
                onCheckedChange={(v) => setEditStart(v === true)}
                className="cursor-pointer"
              />
              <Label htmlFor="bulk-start" className="cursor-pointer">
                Date de début de transport
              </Label>
            </div>
            <DatePicker
              value={start}
              onChange={setStart}
              disabled={!editStart}
              clearable
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-end"
                checked={editEnd}
                onCheckedChange={(v) => setEditEnd(v === true)}
                className="cursor-pointer"
              />
              <Label htmlFor="bulk-end" className="cursor-pointer">
                Date de fin de transport
              </Label>
            </div>
            <DatePicker
              value={end}
              onChange={setEnd}
              disabled={!editEnd}
              clearable
            />
          </div>

          {invalidRange && (
            <p className="text-xs text-destructive">
              La date de début doit précéder la date de fin.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

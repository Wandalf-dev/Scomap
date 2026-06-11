"use client";

import { Columns3, GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { DragEndEvent } from "@dnd-kit/core";

interface SortableColumnRowProps {
  id: string;
  header: string;
  checked: boolean;
  onToggle: () => void;
}

function SortableColumnRow({ id, header, checked, onToggle }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        aria-label="Réorganiser"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="cursor-pointer"
        id={`col-${id}`}
      />
      <label
        htmlFor={`col-${id}`}
        className="flex-1 cursor-pointer text-sm select-none"
      >
        {header}
      </label>
    </div>
  );
}

interface ColumnPickerProps {
  storageKey: string;
  totalColumnCount: number;
  visibleColumnCount: number;
  orderedColumns: Array<{ key: string; header: string }>;
  columnOrder: string[];
  hiddenColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  onReset: () => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function ColumnPicker({
  storageKey,
  totalColumnCount,
  visibleColumnCount,
  orderedColumns,
  columnOrder,
  hiddenColumns,
  onToggleColumn,
  onReset,
  onDragEnd,
}: ColumnPickerProps) {
  const pickerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer">
          <Columns3 className="mr-2 h-4 w-4" />
          Colonnes
          {hiddenColumns.size > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs font-medium bg-primary text-primary-foreground"
            >
              {visibleColumnCount}/{totalColumnCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Colonnes affichées</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Réinitialiser
          </Button>
        </div>
        <DndContext
          id={`datalist-${storageKey}-columns-dnd`}
          sensors={pickerSensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={columnOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="max-h-80 overflow-y-auto py-1">
              {orderedColumns.map((col) => (
                <SortableColumnRow
                  key={col.key}
                  id={col.key}
                  header={col.header}
                  checked={!hiddenColumns.has(col.key)}
                  onToggle={() => onToggleColumn(col.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}

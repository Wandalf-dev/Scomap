"use client";

import { Checkbox } from "@/components/ui/checkbox";

const DAYS = [
  { value: 1, label: "Lundi", short: "L" },
  { value: 2, label: "Mardi", short: "M" },
  { value: 3, label: "Mercredi", short: "Me" },
  { value: 4, label: "Jeudi", short: "J" },
  { value: 5, label: "Vendredi", short: "V" },
  { value: 6, label: "Samedi", short: "S" },
  { value: 7, label: "Dimanche", short: "D" },
];

interface RecurrenceInputProps {
  value: number[];
  onChange: (days: number[]) => void;
}

export function RecurrenceInput({ value, onChange }: RecurrenceInputProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {DAYS.map((day) => {
        const checked = value.includes(day.value);
        return (
          <label
            key={day.value}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => {
                if (c) {
                  onChange([...value, day.value].sort());
                } else {
                  onChange(value.filter((d) => d !== day.value));
                }
              }}
              className="cursor-pointer"
            />
            <span className="text-sm">{day.label}</span>
          </label>
        );
      })}
    </div>
  );
}

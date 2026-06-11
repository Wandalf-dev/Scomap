"use client";

import { useEffect, useState } from "react";

interface ArretTimeInputProps {
  value: string | null;
  locked: boolean;
  onCommit: (time: string | null) => void;
}

export function ArretTimeInput({ value, locked, onCommit }: ArretTimeInputProps) {
  const [local, setLocal] = useState(value ?? "");

  // Keep in sync when the underlying value changes (e.g. after a calc)
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  function commit() {
    const next = local || null;
    if (next !== (value ?? null)) onCommit(next);
  }

  return (
    <input
      type="time"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      title={locked ? "Horaire verrouillé" : undefined}
      className={`h-7 w-[7.5rem] rounded-[0.3rem] border bg-background px-2 text-sm tabular-nums outline-none transition-colors focus:border-ring ${
        locked ? "border-primary/50 text-primary" : "border-input"
      }`}
    />
  );
}

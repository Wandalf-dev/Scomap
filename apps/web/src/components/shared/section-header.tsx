import type { ElementType, ReactNode } from "react";

/** Section title with a primary-tinted icon chip — the shared visual rhythm of
 *  the detail tabs (circuit / usager / chauffeur / véhicule). */
export function SectionHeader({
  icon: Icon,
  children,
}: {
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
        <Icon className="size-4" />
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {children}
      </h2>
    </div>
  );
}

"use client";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export function ModeToggle() {
  return (
    <AnimatedThemeToggler className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground cursor-pointer [&_svg]:size-4" />
  );
}

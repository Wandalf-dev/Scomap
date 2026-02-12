"use client";

import { Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/layout/mode-toggle";

interface SiteHeaderProps {
  onOpenCustomizer?: () => void;
}

export function SiteHeader({ onOpenCustomizer }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex-1" />
        <div className="ml-auto flex items-center gap-2">
          {onOpenCustomizer && (
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenCustomizer}
              className="cursor-pointer"
            >
              <Settings className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">Customizer</span>
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

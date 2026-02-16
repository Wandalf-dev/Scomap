"use client";

import React, { useRef } from "react";
import {
  Layout,
  Loader2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { Cog6ToothIcon } from "@/components/ui/cog6-tooth-icon";
import { SunIcon } from "@/components/ui/sun-icon";
import { MoonIcon } from "@/components/ui/moon-icon";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { radiusOptions } from "@/config/theme-customizer-constants";
import { LayoutTab } from "./layout-tab";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface ThemeCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const { theme, setTheme } = useTheme();
  const {
    config: sidebarConfig,
    radius,
    updateConfig: updateSidebarConfig,
    updateRadius,
    savePreferences,
    isSaving,
    hasUnsavedChanges,
  } = useSidebarConfig();

  const handleReset = () => {
    updateRadius("0.5rem");
    updateSidebarConfig({
      variant: "inset",
      collapsible: "offcanvas",
      side: "left",
    });
  };

  const handleSave = () => {
    savePreferences();
    toast.success("Préférences enregistrées");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side={sidebarConfig.side === "left" ? "right" : "left"}
        className="w-[400px] p-0 gap-0 pointer-events-auto [&>button]:hidden overflow-hidden flex flex-col"
      >
        <SheetHeader className="space-y-0 p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Cog6ToothIcon size={16} />
            </div>
            <SheetTitle className="text-lg font-semibold">
              Customizer
            </SheetTitle>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                className="cursor-pointer h-8 w-8"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">
            Customize the layout of your dashboard.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Mode Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={theme !== "dark" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="cursor-pointer"
                >
                  <SunIcon size={16} className="mr-1" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  <MoonIcon size={16} className="mr-1" />
                  Dark
                </Button>
              </div>
            </div>

            <Separator />

            {/* Radius Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Radius</Label>
              <div className="grid grid-cols-5 gap-2">
                {radiusOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`relative cursor-pointer rounded-md p-3 border transition-colors ${
                      radius === option.value
                        ? "border-primary"
                        : "border-border hover:border-border/60"
                    }`}
                    onClick={() => updateRadius(option.value)}
                  >
                    <div className="text-center">
                      <div className="text-xs font-medium">{option.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Layout Section Header */}
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Layout</Label>
            </div>
          </div>

          {/* Layout Tab content */}
          <LayoutTab />
        </div>

        {/* Save Button - sticky bottom */}
        <div className="border-t p-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="w-full cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ThemeCustomizerTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  const { config: sidebarConfig } = useSidebarConfig();
  const cogRef = useRef<import("@/components/ui/cog6-tooth-icon").Cog6ToothIconHandle>(null);

  return (
    <Button
      onClick={onClick}
      onMouseEnter={() => cogRef.current?.startAnimation()}
      onMouseLeave={() => cogRef.current?.stopAnimation()}
      size="icon"
      className={cn(
        "fixed top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer",
        sidebarConfig.side === "left" ? "right-4" : "left-4"
      )}
    >
      <Cog6ToothIcon ref={cogRef} size={20} />
    </Button>
  );
}

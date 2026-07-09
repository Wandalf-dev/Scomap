"use client";

import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ThemeCustomizer } from "@/components/theme-customizer";
import { Toaster } from "@/components/ui/sonner";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";

interface DashboardShellProps {
  user: {
    name: string;
    email: string;
  };
  isAdmin: boolean;
  signOutAction: () => void;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  isAdmin,
  signOutAction,
  children,
}: DashboardShellProps) {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false);
  const { config } = useSidebarConfig();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      <Toaster />
      {config.side === "left" ? (
        <>
          <AppSidebar
            user={user}
            isAdmin={isAdmin}
            signOutAction={signOutAction}
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
          <SidebarInset className="min-h-0 overflow-hidden">
            <SiteHeader onOpenCustomizer={() => setThemeCustomizerOpen(true)} />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset className="min-h-0 overflow-hidden">
            <SiteHeader onOpenCustomizer={() => setThemeCustomizerOpen(true)} />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
          <AppSidebar
            user={user}
            isAdmin={isAdmin}
            signOutAction={signOutAction}
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
        </>
      )}

      {/* Theme Customizer */}
      <ThemeCustomizer
        open={themeCustomizerOpen}
        onOpenChange={setThemeCustomizerOpen}
      />
    </SidebarProvider>
  );
}

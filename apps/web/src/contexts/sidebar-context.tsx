"use client";

import * as React from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SidebarConfig {
  variant: "sidebar" | "floating" | "inset";
  collapsible: "offcanvas" | "icon" | "none";
  side: "left" | "right";
}

export interface UIPreferences {
  sidebar: SidebarConfig;
  radius: string;
}

export interface SidebarContextValue {
  config: SidebarConfig;
  radius: string;
  updateConfig: (config: Partial<SidebarConfig>) => void;
  updateRadius: (radius: string) => void;
  savePreferences: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

const DEFAULT_CONFIG: SidebarConfig = {
  variant: "inset",
  collapsible: "offcanvas",
  side: "left",
};

const DEFAULT_RADIUS = "0.5rem";

export const SidebarContext = React.createContext<SidebarContextValue | null>(
  null
);

export function SidebarConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: savedPrefs, isSuccess } = useQuery(
    trpc.userPreferences.get.queryOptions()
  );

  const saveMutation = useMutation(
    trpc.userPreferences.save.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.userPreferences.get.queryKey(),
        });
        setHasUnsavedChanges(false);
      },
    })
  );

  const [config, setConfig] = React.useState<SidebarConfig>(DEFAULT_CONFIG);
  const [radius, setRadius] = React.useState(DEFAULT_RADIUS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);

  // Load saved preferences once fetched
  React.useEffect(() => {
    if (isSuccess && !initialized) {
      if (savedPrefs?.sidebar) {
        setConfig(savedPrefs.sidebar);
      }
      if (savedPrefs?.radius) {
        setRadius(savedPrefs.radius);
        document.documentElement.style.setProperty(
          "--radius",
          savedPrefs.radius
        );
      }
      setInitialized(true);
    }
  }, [isSuccess, savedPrefs, initialized]);

  const updateConfig = React.useCallback(
    (newConfig: Partial<SidebarConfig>) => {
      setConfig((prev) => ({ ...prev, ...newConfig }));
      setHasUnsavedChanges(true);
    },
    []
  );

  const updateRadius = React.useCallback((newRadius: string) => {
    setRadius(newRadius);
    document.documentElement.style.setProperty("--radius", newRadius);
    setHasUnsavedChanges(true);
  }, []);

  const savePreferences = React.useCallback(() => {
    saveMutation.mutate({
      sidebar: config,
      radius,
    });
  }, [config, radius, saveMutation]);

  return (
    <SidebarContext.Provider
      value={{
        config,
        radius,
        updateConfig,
        updateRadius,
        savePreferences,
        isSaving: saveMutation.isPending,
        hasUnsavedChanges,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

"use client";

import { createContext, useContext, useState } from "react";

interface HeaderActionsContextValue {
  target: HTMLDivElement | null;
  setTarget: (el: HTMLDivElement | null) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);

export function HeaderActionsProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <HeaderActionsContext.Provider value={{ target, setTarget }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}

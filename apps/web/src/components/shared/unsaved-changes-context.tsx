"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface UnsavedChangesContextValue {
  isDirty: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  /** Réinitialise tous les flags dirty (après confirmation "quitter sans enregistrer"). */
  resetDirty: () => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      const wasDirty = prev.has(key);
      if (wasDirty === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const resetDirty = useCallback(() => {
    setDirtyKeys((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const isDirty = dirtyKeys.size > 0;

  // Garde navigateur : F5 / fermeture d'onglet déclenchent la confirmation native
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const value = useMemo(
    () => ({ isDirty, setDirty, resetDirty }),
    [isDirty, setDirty, resetDirty],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

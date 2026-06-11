import { useMemo } from "react";
import {
  USAGER_STATUSES,
  USAGER_STATUS_LABELS,
  USAGER_REGIMES,
  USAGER_REGIME_LABELS,
  USAGER_TRANSPORT_TYPES,
  USAGER_TRANSPORT_TYPE_LABELS,
  CLASSES_BY_TYPE,
} from "@/lib/validators/usager";
import { CLASSE_LABEL_MAP } from "./usager-list-model";
import type { FilterConfig } from "@/components/shared/data-list";
import type { UsagerRow, UsagerFilters } from "./usager-list-model";

type SelectOption = { value: string; label: string };

export function useUsagerFilterOptions(
  usagersList:
    | Array<Pick<UsagerRow, "etablissementName" | "secondaryEtablissementName">>
    | undefined,
) {
  const etablissementOptions = useMemo(() => {
    if (!usagersList) return [];
    const names = new Set<string>();
    usagersList.forEach((u) => {
      if (u.etablissementName) names.add(u.etablissementName);
    });
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [usagersList]);

  const secondaryEtablissementOptions = useMemo(() => {
    if (!usagersList) return [];
    const names = new Set<string>();
    usagersList.forEach((u) => {
      if (u.secondaryEtablissementName) names.add(u.secondaryEtablissementName);
    });
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [usagersList]);

  const classeOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const list of Object.values(CLASSES_BY_TYPE)) {
      for (const c of list) keys.add(c.value);
    }
    return Array.from(keys).map((k) => ({ value: k, label: CLASSE_LABEL_MAP[k] ?? k }));
  }, []);

  return { etablissementOptions, secondaryEtablissementOptions, classeOptions };
}

interface UsagerFilterOptionLists {
  classeOptions: SelectOption[];
  etablissementOptions: SelectOption[];
  secondaryEtablissementOptions: SelectOption[];
}

export function buildUsagerFilterConfigs({
  classeOptions,
  etablissementOptions,
  secondaryEtablissementOptions,
}: UsagerFilterOptionLists): FilterConfig[] {
  return [
    { key: "displayId", label: "ID", type: "text", placeholder: "#…" },
    { key: "code", label: "Code", type: "text" },
    { key: "lastName", label: "Nom", type: "text" },
    { key: "firstName", label: "Prénom", type: "text" },
    { key: "birthDate", label: "Date de naissance", type: "text", placeholder: "Année ou date…" },
    {
      key: "gender",
      label: "Genre",
      type: "select",
      className: "h-8 w-32 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        { value: "M", label: "Masculin" },
        { value: "F", label: "Féminin" },
      ],
    },
    {
      key: "status",
      label: "Statut",
      type: "select",
      className: "h-8 w-40 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        ...USAGER_STATUSES.map((s) => ({ value: s, label: USAGER_STATUS_LABELS[s] })),
      ],
    },
    {
      key: "regime",
      label: "Régime",
      type: "select",
      className: "h-8 w-40 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        ...USAGER_REGIMES.map((r) => ({ value: r, label: USAGER_REGIME_LABELS[r] })),
      ],
    },
    {
      key: "classe",
      label: "Classe",
      type: "select",
      className: "h-8 w-32 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Toutes" },
        ...classeOptions,
      ],
    },
    {
      key: "transportType",
      label: "Type de transport",
      type: "select",
      className: "h-8 w-56 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        ...USAGER_TRANSPORT_TYPES.map((t) => ({ value: t, label: USAGER_TRANSPORT_TYPE_LABELS[t] })),
      ],
    },
    {
      key: "etablissementName",
      label: "Établissement",
      type: "select",
      className: "h-8 w-56 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        ...etablissementOptions,
      ],
    },
    { key: "etablissementCity", label: "Ville", type: "text" },
    {
      key: "secondaryEtablissementName",
      label: "Établissement secondaire",
      type: "select",
      className: "h-8 w-56 cursor-pointer text-sm",
      options: [
        { value: "all", label: "Tous" },
        ...secondaryEtablissementOptions,
      ],
    },
    { key: "transportStartDate", label: "Début transport", type: "text", placeholder: "Année ou date…" },
    { key: "transportEndDate", label: "Fin transport", type: "text", placeholder: "Année ou date…" },
    { key: "transportParticularity", label: "Particularité transport", type: "text" },
    { key: "specificity", label: "Spécificité", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
  ];
}

export function usagerFilterFn(row: UsagerRow, filters: UsagerFilters): boolean {
  if (filters.displayId && !String(row.displayId).includes(filters.displayId.replace(/^#/, ""))) return false;
  if (filters.code && !row.code?.toLowerCase().includes(filters.code.toLowerCase())) return false;
  if (filters.lastName && !row.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) return false;
  if (filters.firstName && !row.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) return false;
  if (filters.birthDate && !(row.birthDate ?? "").includes(filters.birthDate)) return false;
  if (filters.gender !== "all" && row.gender !== filters.gender) return false;
  if (filters.status !== "all" && row.status !== filters.status) return false;
  if (filters.regime !== "all" && row.regime !== filters.regime) return false;
  if (filters.classe !== "all" && row.classe !== filters.classe) return false;
  if (filters.transportType !== "all" && row.transportType !== filters.transportType) return false;
  if (filters.etablissementName !== "all" && row.etablissementName !== filters.etablissementName) return false;
  if (filters.etablissementCity && !row.etablissementCity?.toLowerCase().includes(filters.etablissementCity.toLowerCase())) return false;
  if (filters.secondaryEtablissementName !== "all" && row.secondaryEtablissementName !== filters.secondaryEtablissementName) return false;
  if (filters.transportStartDate && !(row.transportStartDate ?? "").includes(filters.transportStartDate)) return false;
  if (filters.transportEndDate && !(row.transportEndDate ?? "").includes(filters.transportEndDate)) return false;
  if (filters.transportParticularity && !row.transportParticularity?.toLowerCase().includes(filters.transportParticularity.toLowerCase())) return false;
  if (filters.specificity && !row.specificity?.toLowerCase().includes(filters.specificity.toLowerCase())) return false;
  if (filters.notes && !row.notes?.toLowerCase().includes(filters.notes.toLowerCase())) return false;
  return true;
}

export function usagerSortFn(
  a: UsagerRow,
  b: UsagerRow,
  column: string,
  direction: "asc" | "desc",
): number {
  const aRaw = a[column as keyof UsagerRow];
  const bRaw = b[column as keyof UsagerRow];
  let cmp: number;
  if (typeof aRaw === "number" && typeof bRaw === "number") {
    cmp = aRaw - bRaw;
  } else {
    const aVal = (aRaw ?? "") as string;
    const bVal = (bRaw ?? "") as string;
    cmp = aVal.localeCompare(bVal, "fr", { sensitivity: "base" });
  }
  return direction === "asc" ? cmp : -cmp;
}

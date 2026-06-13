"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Printer,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftCircle,
  ArrowRightCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateISO } from "@/lib/utils/date-helpers";
import {
  EVENT_COLORS,
  CUSTOMIZED_BAND_COLOR,
  countActiveFilters,
  type SchedulerViewMode,
  type ResourceMode,
  type EventDensity,
  type SchedulerFilters,
} from "./types";

interface FilterOption {
  id: string;
  label: string;
}

interface SchedulerToolbarProps {
  view: SchedulerViewMode;
  onViewChange: (view: SchedulerViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  rangeLabel: string;
  resourceMode: ResourceMode;
  onResourceModeChange: (mode: ResourceMode) => void;
  rowFilter: string;
  onRowFilterChange: (value: string) => void;
  contentFilter: string;
  onContentFilterChange: (value: string) => void;
  filters: SchedulerFilters;
  onApplyFilters: (filters: SchedulerFilters) => void;
  circuitOptions: FilterOption[];
  etablissementOptions: FilterOption[];
  chauffeurOptions: FilterOption[];
  vehiculeOptions: FilterOption[];
  density: EventDensity;
  onDensityChange: (density: EventDensity) => void;
  rowHeaderWide: boolean;
  onRowHeaderWideChange: (wide: boolean) => void;
  cellWidth: number;
  onCellWidthChange: (width: number) => void;
  onPrint: () => void;
  onRefresh: () => void;
  isFetching: boolean;
}

const VIEW_BUTTONS: { value: SchedulerViewMode; label: string; title: string }[] =
  [
    { value: "jour", label: "Jour", title: "Heures sur 1 jour" },
    { value: "semaine", label: "Semaine", title: "Jours sur 1 semaine" },
    { value: "mois", label: "Mois", title: "Jours sur 1 mois" },
    { value: "trimestre", label: "3 mois", title: "Jours sur 3 mois" },
  ];

export function SchedulerToolbar({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onNavigate,
  onToday,
  rangeLabel,
  resourceMode,
  onResourceModeChange,
  rowFilter,
  onRowFilterChange,
  contentFilter,
  onContentFilterChange,
  filters,
  onApplyFilters,
  circuitOptions,
  etablissementOptions,
  chauffeurOptions,
  vehiculeOptions,
  density,
  onDensityChange,
  rowHeaderWide,
  onRowHeaderWideChange,
  cellWidth,
  onCellWidthChange,
  onPrint,
  onRefresh,
  isFetching,
}: SchedulerToolbarProps) {
  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left cluster: text filters + légende + filter form (legacy layout) */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={rowFilter}
            onChange={(e) => onRowFilterChange(e.target.value)}
            placeholder={
              resourceMode === "chauffeurs"
                ? "Filtre chauffeur"
                : "Filtre véhicule"
            }
            className="h-8 w-36 text-sm"
          />
          <Input
            value={contentFilter}
            onChange={(e) => onContentFilterChange(e.target.value)}
            placeholder="Filtre contenu"
            className="h-8 w-36 text-sm"
          />

          <LegendDropdown />

          <FilterPopover
            filters={filters}
            onApplyFilters={onApplyFilters}
            circuitOptions={circuitOptions}
            etablissementOptions={etablissementOptions}
            chauffeurOptions={chauffeurOptions}
            vehiculeOptions={vehiculeOptions}
            activeFilterCount={activeFilterCount}
          />

          {/* Planning type: chauffeurs vs véhicules (legacy SAL / LOC) */}
          <div className="flex items-center rounded-[0.3rem] border border-border">
            <Button
              variant={resourceMode === "chauffeurs" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onResourceModeChange("chauffeurs")}
              className="h-8 cursor-pointer rounded-none rounded-l-[0.3rem]"
            >
              Chauffeurs
            </Button>
            <Button
              variant={resourceMode === "vehicules" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onResourceModeChange("vehicules")}
              className="h-8 cursor-pointer rounded-none rounded-r-[0.3rem]"
            >
              Véhicules
            </Button>
          </div>
        </div>

        {/* Right cluster: navigation + views + display options + actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(-1)}
            className="h-8 cursor-pointer px-2"
            title="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 cursor-pointer"
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(1)}
            className="h-8 cursor-pointer px-2"
            title="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <DatePicker
            value={formatDateISO(currentDate)}
            onChange={(iso) => {
              if (iso) onDateChange(new Date(iso + "T00:00:00"));
            }}
            className="w-36"
          />

          <div className="flex items-center rounded-[0.3rem] border border-border">
            {VIEW_BUTTONS.map((btn, i) => (
              <Button
                key={btn.value}
                variant={view === btn.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewChange(btn.value)}
                title={btn.title}
                className={`h-8 cursor-pointer rounded-none px-2.5 ${
                  i === 0 ? "rounded-l-[0.3rem]" : ""
                } ${i === VIEW_BUTTONS.length - 1 ? "rounded-r-[0.3rem]" : ""}`}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Row/column density (legacy "Ligne étendue/condensée", "Colonne…") */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onDensityChange(density === "expanded" ? "condensed" : "expanded")
            }
            title={density === "expanded" ? "Ligne condensée" : "Ligne étendue"}
            className="h-8 cursor-pointer px-2 text-muted-foreground"
          >
            {density === "expanded" ? (
              <ArrowUpCircle className="h-4 w-4" />
            ) : (
              <ArrowDownCircle className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRowHeaderWideChange(!rowHeaderWide)}
            title={rowHeaderWide ? "Colonne condensée" : "Colonne étendue"}
            className="h-8 cursor-pointer px-2 text-muted-foreground"
          >
            {rowHeaderWide ? (
              <ArrowLeftCircle className="h-4 w-4" />
            ) : (
              <ArrowRightCircle className="h-4 w-4" />
            )}
          </Button>

          <input
            type="range"
            min={10}
            max={100}
            value={cellWidth}
            onChange={(e) => onCellWidthChange(Number(e.target.value))}
            title="Largeur des cellules"
            className="h-8 w-24 cursor-pointer accent-primary"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={onPrint}
            title="Imprimer"
            className="h-8 cursor-pointer px-2 text-muted-foreground"
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            title="Rafraîchir"
            className="h-8 cursor-pointer px-2 text-muted-foreground"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="text-sm font-medium capitalize text-muted-foreground">
        {rangeLabel}
      </div>
    </div>
  );
}

function LegendSwatch({ color }: { color: string }) {
  return (
    <span
      className="h-3 w-5 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
  );
}

function LegendDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 cursor-pointer">
          Légende
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Légende</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-2 px-2 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <LegendSwatch color={EVENT_COLORS.aller.bg} />
            Trajet aller
          </div>
          <div className="flex items-center gap-2">
            <LegendSwatch color={EVENT_COLORS.retour.bg} />
            Trajet retour
          </div>
          <div className="flex items-center gap-2">
            <LegendSwatch color={EVENT_COLORS.annule.bg} />
            Occurrence annulée
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-5 shrink-0 rounded-[2px] bg-muted"
              style={{ borderTop: `3px solid ${CUSTOMIZED_BAND_COLOR}` }}
            />
            Bandeau orange : occurrence personnalisée
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-5 shrink-0 rounded-[2px] border border-border bg-neutral-200 dark:bg-neutral-700" />
            Cellule grisée : week-end
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center italic text-muted-foreground">
              —
            </span>
            Ligne « Non affecté » : sans chauffeur / véhicule
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface FilterPopoverProps {
  filters: SchedulerFilters;
  onApplyFilters: (filters: SchedulerFilters) => void;
  circuitOptions: FilterOption[];
  etablissementOptions: FilterOption[];
  chauffeurOptions: FilterOption[];
  vehiculeOptions: FilterOption[];
  activeFilterCount: number;
}

// Staged filters: like the legacy form, nothing applies until
// "Appliquer le filtre" is clicked.
function FilterPopover({
  filters,
  onApplyFilters,
  circuitOptions,
  etablissementOptions,
  chauffeurOptions,
  vehiculeOptions,
  activeFilterCount,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [staged, setStaged] = useState<SchedulerFilters>(filters);

  function handleOpenChange(next: boolean) {
    if (next) setStaged(filters);
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="h-8 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          Filtrer
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <FilterSelect
          label="Circuit"
          placeholder="Tous les circuits"
          value={staged.circuitId}
          options={circuitOptions}
          onChange={(v) => setStaged((s) => ({ ...s, circuitId: v }))}
        />
        <FilterSelect
          label="Établissement"
          placeholder="Tous les établissements"
          value={staged.etablissementId}
          options={etablissementOptions}
          onChange={(v) => setStaged((s) => ({ ...s, etablissementId: v }))}
        />
        <FilterSelect
          label="Chauffeur"
          placeholder="Tous les chauffeurs"
          value={staged.chauffeurId}
          options={chauffeurOptions}
          onChange={(v) => setStaged((s) => ({ ...s, chauffeurId: v }))}
        />
        <FilterSelect
          label="Véhicule"
          placeholder="Tous les véhicules"
          value={staged.vehiculeId}
          options={vehiculeOptions}
          onChange={(v) => setStaged((s) => ({ ...s, vehiculeId: v }))}
        />
        <FilterSelect
          label="Direction"
          placeholder="Aller et retour"
          value={staged.direction}
          options={[
            { id: "aller", label: "Aller" },
            { id: "retour", label: "Retour" },
          ]}
          onChange={(v) => setStaged((s) => ({ ...s, direction: v }))}
        />
        <FilterSelect
          label="Statut"
          placeholder="Tous les statuts"
          value={staged.statut}
          options={[
            { id: "planifie", label: "Planifié" },
            { id: "en_cours", label: "En cours" },
            { id: "termine", label: "Terminé" },
            { id: "annule", label: "Annulé" },
          ]}
          onChange={(v) => setStaged((s) => ({ ...s, statut: v }))}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-muted-foreground"
            onClick={() => {
              const cleared: SchedulerFilters = {
                circuitId: null,
                etablissementId: null,
                chauffeurId: null,
                vehiculeId: null,
                direction: null,
                statut: null,
              };
              setStaged(cleared);
              onApplyFilters(cleared);
              setOpen(false);
            }}
          >
            Réinitialiser
          </Button>
          <Button
            size="sm"
            className="cursor-pointer bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
            onClick={() => {
              onApplyFilters(staged);
              setOpen(false);
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            Appliquer le filtre
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterSelectProps {
  label: string;
  placeholder: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}

function FilterSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

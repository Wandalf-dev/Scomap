"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Route,
  ExternalLink,
  X,
  ListFilter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CircuitFormDialog } from "./circuit-form-dialog";
import { CircuitDeleteDialog } from "./circuit-delete-dialog";
import type { CircuitFormValues } from "@/lib/validators/circuit";

const DAY_LABELS: Record<number, string> = {
  1: "L",
  2: "M",
  3: "Me",
  4: "J",
  5: "V",
  6: "S",
  7: "D",
};

interface CircuitRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  operatingDays: unknown;
}

interface ColumnFilters {
  name: string;
  status: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  name: "",
  status: "all",
};

export function CircuitsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CircuitRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<CircuitRow | null>(null);

  const { data: circuitsList, isLoading, error } = useQuery(
    trpc.circuits.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.circuits.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.circuits.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.circuits.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.circuits.list.queryKey(),
        });
        toast.success("Circuit supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const hasActiveFilters = useMemo(
    () => filters.name !== "" || filters.status !== "all",
    [filters],
  );

  const filtered = useMemo(() => {
    if (!circuitsList) return [];
    return circuitsList.filter((c) => {
      if (filters.name && !c.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.status === "active" && !c.isActive) return false;
      if (filters.status === "inactive" && c.isActive) return false;
      return true;
    });
  }, [circuitsList, filters]);

  function updateFilter(key: keyof ColumnFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function handleEdit(item: CircuitRow) {
    setEditingItem(item);
    setFormMode("edit");
    setFormOpen(true);
  }

  function handleFormSubmit(values: CircuitFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: values,
      });
    }
  }

  function handleDelete() {
    if (deleteItem) {
      deleteMutation.mutate({ id: deleteItem.id });
    }
  }

  function renderDayBadges(days: unknown) {
    if (!Array.isArray(days) || days.length === 0) {
      return <span className="text-muted-foreground/60">&mdash;</span>;
    }
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <Badge
            key={d}
            variant={days.includes(d) ? "default" : "outline"}
            className={`h-6 w-7 justify-center px-0 text-xs ${
              days.includes(d)
                ? ""
                : "text-muted-foreground/40 border-border/50"
            }`}
          >
            {DAY_LABELS[d]}
          </Badge>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Erreur lors du chargement des circuits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Circuits
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerez vos circuits de transport
          </p>
        </div>
        <Button
          onClick={() => router.push("/circuits/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Toolbar */}
      {circuitsList && circuitsList.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            variant={showFilters || hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setShowFilters(!showFilters);
              if (showFilters && hasActiveFilters) clearFilters();
            }}
            className="cursor-pointer"
          >
            <ListFilter className="mr-2 h-4 w-4" />
            Filtres
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs font-medium bg-primary text-primary-foreground">
                {Object.entries(filters).filter(([k, v]) => k === "status" ? v !== "all" : v !== "").length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <>
              <span className="text-sm text-muted-foreground">
                {filtered.length} sur {circuitsList.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reinitialiser
              </Button>
            </>
          )}
        </div>
      )}

      {/* Filters bar */}
      {showFilters && circuitsList && circuitsList.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-[0.3rem] border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nom</label>
            <Input
              placeholder="Rechercher..."
              value={filters.name}
              onChange={(e) => updateFilter("name", e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <Select
              value={filters.status}
              onValueChange={(v) => updateFilter("status", v)}
            >
              <SelectTrigger className="h-8 w-36 cursor-pointer text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Tous</SelectItem>
                <SelectItem value="active" className="cursor-pointer">Actif</SelectItem>
                <SelectItem value="inactive" className="cursor-pointer">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Table or Loading or Empty */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !circuitsList || circuitsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Route className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun circuit
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Commencez par ajouter votre premier circuit.
          </p>
          <Button
            onClick={() => router.push("/circuits/new")}
            variant="outline"
            className="mt-4 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un circuit
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.3rem] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nom
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Jours
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Statut
                </TableHead>
                <TableHead className="h-10 w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Route className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Aucun resultat pour ces filtres</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer group transition-colors"
                    onClick={() => router.push(`/circuits/${item.id}`)}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground max-w-[300px] truncate">
                      {item.description || <span className="text-muted-foreground/60">&mdash;</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {renderDayBadges(item.operatingDays)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={item.isActive ? "default" : "secondary"} className={item.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
                        {item.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/circuits/${item.id}`);
                            }}
                            className="cursor-pointer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Voir la fiche
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier rapidement
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteItem(item);
                            }}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <CircuitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? { name: editingItem.name }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      {/* Delete Dialog */}
      <CircuitDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        name={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

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
  Truck,
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
import { VehiculeFormDialog } from "./vehicule-form-dialog";
import { VehiculeDeleteDialog } from "./vehicule-delete-dialog";
import type { VehiculeFormValues } from "@/lib/validators/vehicule";

interface VehiculeRow {
  id: string;
  name: string;
  licensePlate: string | null;
  brand: string | null;
  model: string | null;
  capacity: number | null;
  isActive: boolean;
}

interface ColumnFilters {
  name: string;
  licensePlate: string;
  status: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  name: "",
  licensePlate: "",
  status: "all",
};

export function VehiculesClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<VehiculeRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<VehiculeRow | null>(null);

  const { data: vehiculesList, isLoading, error } = useQuery(
    trpc.vehicules.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.vehicules.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule cree avec succes");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la creation");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.vehicules.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule modifie avec succes");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.vehicules.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vehicules.list.queryKey(),
        });
        toast.success("Vehicule supprime");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  const hasActiveFilters = useMemo(
    () =>
      filters.name !== "" ||
      filters.licensePlate !== "" ||
      filters.status !== "all",
    [filters],
  );

  const filtered = useMemo(() => {
    if (!vehiculesList) return [];
    return vehiculesList.filter((v) => {
      if (filters.name && !v.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.licensePlate && !v.licensePlate?.toLowerCase().includes(filters.licensePlate.toLowerCase())) return false;
      if (filters.status === "active" && !v.isActive) return false;
      if (filters.status === "inactive" && v.isActive) return false;
      return true;
    });
  }, [vehiculesList, filters]);

  function updateFilter(key: keyof ColumnFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function handleEdit(item: VehiculeRow) {
    setEditingItem(item);
    setFormMode("edit");
    setFormOpen(true);
  }

  function handleFormSubmit(values: VehiculeFormValues) {
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

  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Erreur lors du chargement des vehicules.
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
            Vehicules
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerez votre flotte de vehicules
          </p>
        </div>
        <Button
          onClick={() => router.push("/vehicules/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Toolbar */}
      {vehiculesList && vehiculesList.length > 0 && (
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
                {filtered.length} sur {vehiculesList.length}
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
      {showFilters && vehiculesList && vehiculesList.length > 0 && (
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
            <label className="text-xs font-medium text-muted-foreground">Immatriculation</label>
            <Input
              placeholder="Rechercher..."
              value={filters.licensePlate}
              onChange={(e) => updateFilter("licensePlate", e.target.value)}
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
      ) : !vehiculesList || vehiculesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Truck className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun vehicule
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Commencez par ajouter votre premier vehicule.
          </p>
          <Button
            onClick={() => router.push("/vehicules/new")}
            variant="outline"
            className="mt-4 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un vehicule
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
                  Immatriculation
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Marque / Modele
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capacite
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
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Truck className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Aucun resultat pour ces filtres</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer group transition-colors"
                    onClick={() => router.push(`/vehicules/${item.id}`)}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.licensePlate || <span className="text-muted-foreground/60">&mdash;</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.brand || item.model
                        ? [item.brand, item.model].filter(Boolean).join(" ")
                        : <span className="text-muted-foreground/60">&mdash;</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.capacity ?? <span className="text-muted-foreground/60">&mdash;</span>}
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
                              router.push(`/vehicules/${item.id}`);
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
      <VehiculeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                name: editingItem.name,
                licensePlate: editingItem.licensePlate ?? "",
                capacity: editingItem.capacity?.toString() ?? "",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      {/* Delete Dialog */}
      <VehiculeDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        name={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

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
  Users,
  ExternalLink,
  X,
  ListFilter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
import { UsagerFormDialog } from "./usager-form-dialog";
import { UsagerDeleteDialog } from "./usager-delete-dialog";
import type { UsagerFormValues } from "@/lib/validators/usager";

interface UsagerRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: string | null;
  etablissementId: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
}

interface ColumnFilters {
  lastName: string;
  firstName: string;
  etablissement: string;
  city: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  lastName: "",
  firstName: "",
  etablissement: "all",
  city: "",
};

type SortColumn = "lastName" | "firstName" | "birthDate" | "etablissementName" | "etablissementCity";
type SortDirection = "asc" | "desc";

export function UsagersClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<UsagerRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsagerRow | null>(null);

  const { data: usagersList, isLoading, error } = useQuery(
    trpc.usagers.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.usagers.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager créé avec succès");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.usagers.updateDetail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager modifié avec succès");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.usagers.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.usagers.list.queryKey(),
        });
        toast.success("Usager supprimé");
        setDeleteItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la suppression");
      },
    }),
  );

  // Get unique etablissement names for filter
  const etablissementOptions = useMemo(() => {
    if (!usagersList) return [];
    const names = new Set<string>();
    usagersList.forEach((u) => {
      if (u.etablissementName) names.add(u.etablissementName);
    });
    return Array.from(names).sort();
  }, [usagersList]);

  const hasActiveFilters = useMemo(
    () =>
      filters.lastName !== "" ||
      filters.firstName !== "" ||
      filters.etablissement !== "all" ||
      filters.city !== "",
    [filters],
  );

  const filtered = useMemo(() => {
    if (!usagersList) return [];
    const result = usagersList.filter((u) => {
      if (filters.lastName && !u.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) return false;
      if (filters.firstName && !u.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) return false;
      if (filters.etablissement !== "all" && u.etablissementName !== filters.etablissement) return false;
      if (filters.city && !u.etablissementCity?.toLowerCase().includes(filters.city.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      const aVal = (a[sortColumn] ?? "") as string;
      const bVal = (b[sortColumn] ?? "") as string;
      const cmp = aVal.localeCompare(bVal, "fr", { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [usagersList, filters, sortColumn, sortDirection]);

  function updateFilter(key: keyof ColumnFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function SortIcon({ column }: { column: SortColumn }) {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  }

  function handleEdit(item: UsagerRow) {
    setEditingItem(item);
    setFormMode("edit");
    setFormOpen(true);
  }

  function handleFormSubmit(values: UsagerFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (formMode === "edit" && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          birthDate: values.birthDate,
          gender: values.gender,
          etablissementId: values.etablissementId,
        },
      });
    }
  }

  function handleDelete() {
    if (deleteItem) {
      deleteMutation.mutate({ id: deleteItem.id });
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR");
    } catch {
      return dateStr;
    }
  }

  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">
          Erreur lors du chargement des usagers.
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
            Usagers
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les élèves transportés
          </p>
        </div>
        <Button
          onClick={() => router.push("/usagers/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Toolbar : toggle filtres + compteur */}
      {usagersList && usagersList.length > 0 && (
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
                {Object.entries(filters).filter(([k, v]) => k === "etablissement" ? v !== "all" : v !== "").length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <>
              <span className="text-sm text-muted-foreground">
                {filtered.length} sur {usagersList.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            </>
          )}
        </div>
      )}

      {/* Filters bar */}
      {showFilters && usagersList && usagersList.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-[0.3rem] border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nom</label>
            <Input
              placeholder="Rechercher..."
              value={filters.lastName}
              onChange={(e) => updateFilter("lastName", e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Prénom</label>
            <Input
              placeholder="Rechercher..."
              value={filters.firstName}
              onChange={(e) => updateFilter("firstName", e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Établissement</label>
            <Select
              value={filters.etablissement}
              onValueChange={(v) => updateFilter("etablissement", v)}
            >
              <SelectTrigger className="h-8 w-48 cursor-pointer text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">
                  Tous
                </SelectItem>
                {etablissementOptions.map((name) => (
                  <SelectItem key={name} value={name} className="cursor-pointer">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Ville</label>
            <Input
              placeholder="Rechercher..."
              value={filters.city}
              onChange={(e) => updateFilter("city", e.target.value)}
              className="h-8 w-40 text-sm"
            />
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
      ) : !usagersList || usagersList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun usager
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Commencez par ajouter votre premier usager.
          </p>
          <Button
            onClick={() => router.push("/usagers/new")}
            variant="outline"
            className="mt-4 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un usager
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.3rem] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                <TableHead
                  className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("lastName")}
                >
                  <span className="flex items-center">
                    Nom
                    <SortIcon column="lastName" />
                  </span>
                </TableHead>
                <TableHead
                  className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("firstName")}
                >
                  <span className="flex items-center">
                    Prénom
                    <SortIcon column="firstName" />
                  </span>
                </TableHead>
                <TableHead
                  className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("birthDate")}
                >
                  <span className="flex items-center">
                    Date de naissance
                    <SortIcon column="birthDate" />
                  </span>
                </TableHead>
                <TableHead
                  className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("etablissementName")}
                >
                  <span className="flex items-center">
                    Établissement
                    <SortIcon column="etablissementName" />
                  </span>
                </TableHead>
                <TableHead
                  className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("etablissementCity")}
                >
                  <span className="flex items-center">
                    Ville
                    <SortIcon column="etablissementCity" />
                  </span>
                </TableHead>
                <TableHead className="h-10 w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Users className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Aucun résultat pour ces filtres</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer group transition-colors"
                    onClick={() => router.push(`/usagers/${item.id}`)}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {item.lastName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-foreground">
                      {item.firstName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.birthDate) || <span className="text-muted-foreground/60">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.etablissementName || <span className="text-muted-foreground/60">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.etablissementCity || <span className="text-muted-foreground/60">—</span>}
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
                              router.push(`/usagers/${item.id}`);
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
      <UsagerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                firstName: editingItem.firstName,
                lastName: editingItem.lastName,
                birthDate: editingItem.birthDate ?? "",
                gender: (editingItem.gender as "M" | "F" | "") ?? "",
                etablissementId: editingItem.etablissementId ?? "",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      {/* Delete Dialog */}
      <UsagerDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        name={deleteItem ? `${deleteItem.firstName} ${deleteItem.lastName}` : ""}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

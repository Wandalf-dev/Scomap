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
  School,
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
import { EtablissementFormDialog } from "./etablissement-form-dialog";
import { EtablissementDeleteDialog } from "./etablissement-delete-dialog";
import type { EtablissementFormValues } from "@/lib/validators/etablissement";

const TYPE_LABELS: Record<string, string> = {
  ecole: "École",
  college: "Collège",
  lycee: "Lycée",
  autre: "Autre",
};

const TYPE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "ecole", label: "École" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "autre", label: "Autre" },
];

interface Etablissement {
  id: string;
  name: string;
  type: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

interface ColumnFilters {
  name: string;
  type: string;
  city: string;
  phone: string;
  email: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  name: "",
  type: "all",
  city: "",
  phone: "",
  email: "",
};

export function EtablissementsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<Etablissement | null>(null);
  const [deleteItem, setDeleteItem] = useState<Etablissement | null>(null);

  const { data: etablissements, isLoading, error } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.etablissements.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Établissement créé avec succès");
        setFormOpen(false);
      },
      onError: () => {
        toast.error("Erreur lors de la création");
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.etablissements.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Établissement modifié avec succès");
        setFormOpen(false);
        setEditingItem(null);
      },
      onError: () => {
        toast.error("Erreur lors de la modification");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.etablissements.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.etablissements.list.queryKey(),
        });
        toast.success("Établissement supprimé");
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
      filters.type !== "all" ||
      filters.city !== "" ||
      filters.phone !== "" ||
      filters.email !== "",
    [filters],
  );

  const filtered = useMemo(() => {
    if (!etablissements) return [];
    return etablissements.filter((e) => {
      if (filters.name && !e.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.type !== "all" && e.type !== filters.type) return false;
      if (filters.city && !e.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.phone && !e.phone?.toLowerCase().includes(filters.phone.toLowerCase())) return false;
      if (filters.email && !e.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
      return true;
    });
  }, [etablissements, filters]);

  function updateFilter(key: keyof ColumnFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function handleEdit(item: Etablissement) {
    setEditingItem(item);
    setFormMode("edit");
    setFormOpen(true);
  }

  function handleFormSubmit(values: EtablissementFormValues) {
    if (formMode === "create") {
      createMutation.mutate(values);
    } else if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: values });
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
          Erreur lors du chargement des établissements.
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
            Établissements
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les établissements scolaires
          </p>
        </div>
        <Button
          onClick={() => router.push("/etablissements/new")}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Toolbar : toggle filtres + compteur */}
      {etablissements && etablissements.length > 0 && (
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
                {Object.entries(filters).filter(([k, v]) => k === "type" ? v !== "all" : v !== "").length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <>
              <span className="text-sm text-muted-foreground">
                {filtered.length} sur {etablissements.length}
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
      {showFilters && etablissements && etablissements.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-[0.3rem] border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nom</label>
            <Input
              placeholder="Rechercher..."
              value={filters.name}
              onChange={(e) => updateFilter("name", e.target.value)}
              className="h-8 w-44 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select
              value={filters.type}
              onValueChange={(v) => updateFilter("type", v)}
            >
              <SelectTrigger className="h-8 w-40 cursor-pointer text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="cursor-pointer">
                    {t.label}
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
            <Input
              placeholder="Rechercher..."
              value={filters.phone}
              onChange={(e) => updateFilter("phone", e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input
              placeholder="Rechercher..."
              value={filters.email}
              onChange={(e) => updateFilter("email", e.target.value)}
              className="h-8 w-48 text-sm"
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
      ) : !etablissements || etablissements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[0.3rem] border border-dashed border-border py-16">
          <School className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Aucun établissement
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Commencez par ajouter votre premier établissement.
          </p>
          <Button
            onClick={() => router.push("/etablissements/new")}
            variant="outline"
            className="mt-4 cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un établissement
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
                <TableHead className="h-10 w-[120px] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ville
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Téléphone
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="h-10 w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <School className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Aucun résultat pour ces filtres</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer group transition-colors"
                    onClick={() => router.push(`/etablissements/${item.id}`)}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell className="px-4 py-3 w-[120px]">
                      {item.type ? (
                        <Badge variant="outline" className="font-normal">
                          {TYPE_LABELS[item.type] ?? item.type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.city || <span className="text-muted-foreground/60">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.phone || <span className="text-muted-foreground/60">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {item.email || <span className="text-muted-foreground/60">—</span>}
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
                              router.push(`/etablissements/${item.id}`);
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
      <EtablissementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingItem
            ? {
                name: editingItem.name,
                type: editingItem.type ?? "",
                address: editingItem.address,
                city: editingItem.city ?? "",
                postalCode: editingItem.postalCode ?? "",
                phone: editingItem.phone ?? "",
                email: editingItem.email ?? "",
              }
            : undefined
        }
        isPending={createMutation.isPending || updateMutation.isPending}
        mode={formMode}
      />

      {/* Delete Dialog */}
      <EtablissementDeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        name={deleteItem?.name ?? ""}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

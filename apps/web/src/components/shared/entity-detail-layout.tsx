"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DeleteIcon } from "@/components/ui/delete-icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from "@/components/shared/unsaved-changes-context";
import {
  HeaderActionsProvider,
  useHeaderActions,
} from "@/components/shared/header-actions-context";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

/** Entry in the "⋯" menu (e.g. Archive), displayed above Delete.
 *  The icon accepts both lucide icons and our custom animated icons. */
export interface DetailMenuAction {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}

interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/** Menu item whose animated icon triggers on hover/focus of the entire row
 *  (not just the icon itself). Lucide icons simply ignore the ref
 *  (start/stopAnimation calls are then no-ops). */
function MenuActionItem({
  icon: Icon,
  label,
  onSelect,
  disabled,
  destructive,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const IconWithRef = Icon as unknown as React.ForwardRefExoticComponent<
    { size?: number; className?: string } & React.RefAttributes<AnimatedIconHandle>
  >;
  const animate = () => iconRef.current?.startAnimation?.();
  const stop = () => iconRef.current?.stopAnimation?.();

  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      onMouseEnter={animate}
      onMouseLeave={stop}
      onFocus={animate}
      onBlur={stop}
      className={cn(
        "cursor-pointer",
        destructive && "text-destructive focus:text-destructive",
      )}
    >
      <IconWithRef ref={iconRef} size={16} className="mr-2" />
      {label}
    </DropdownMenuItem>
  );
}

interface EntityDetailLayoutProps {
  isLoading: boolean;
  entity: unknown | undefined;
  backHref: string;
  entityName: string;
  title: string;
  badges?: React.ReactNode;
  onDelete: () => void;
  isDeleting: boolean;
  deleteEntityName: string;
  deleteLabel: string;
  tabs: Tab[];
  /** Initial tab (e.g. from ?tab=...). Ignored if it doesn't match any tab. */
  defaultTab?: string;
  /** Additional actions in the header band (e.g. Archive), before Delete. */
  headerExtra?: React.ReactNode;
  /** Actions placed in the "⋯" menu, above Delete. */
  menuActions?: DetailMenuAction[];
}

function HeaderActionsSlot() {
  const ctx = useHeaderActions();
  return <div ref={ctx?.setTarget} className="flex items-center gap-2" />;
}

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  cancelLabel: string;
  onConfirm: () => void;
}

/** Shared confirmation dialog (Back button + tab change). */
function UnsavedChangesDialog({
  open,
  onOpenChange,
  description,
  cancelLabel,
  onConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Quitter sans enregistrer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BackButton({ backHref }: { backHref: string }) {
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleClick() {
    if (unsaved?.isDirty) {
      setConfirmOpen(true);
    } else {
      router.push(backHref);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Button>
      <UnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        description="Vous avez des modifications non enregistrées. Si vous quittez maintenant, elles seront perdues. Voulez-vous vraiment continuer ?"
        cancelLabel="Rester sur la page"
        onConfirm={() => {
          unsaved?.resetDirty();
          router.push(backHref);
        }}
      />
    </>
  );
}

export function EntityDetailLayout(props: EntityDetailLayoutProps) {
  return (
    <UnsavedChangesProvider>
      <HeaderActionsProvider>
        <EntityDetailLayoutInner {...props} />
      </HeaderActionsProvider>
    </UnsavedChangesProvider>
  );
}

function EntityDetailLayoutInner({
  isLoading,
  entity,
  backHref,
  entityName,
  title,
  badges,
  onDelete,
  isDeleting,
  deleteEntityName,
  deleteLabel,
  tabs,
  defaultTab,
  headerExtra,
  menuActions,
}: EntityDetailLayoutProps) {
  const router = useRouter();
  const unsaved = useUnsavedChanges();
  const activeDefault =
    defaultTab && tabs.some((t) => t.value === defaultTab)
      ? defaultTab
      : tabs[0]?.value;
  const [activeTab, setActiveTab] = useState(activeDefault);
  // Tab requested while awaiting confirmation (dirty form)
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Changes the tab and rewrites ?tab= in the URL (preserving other params, e.g. ?back=)
  const applyTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      const params = new URLSearchParams(window.location.search);
      params.set("tab", value);
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  function handleTabChange(value: string) {
    if (unsaved?.isDirty) {
      setPendingTab(value);
    } else {
      applyTabChange(value);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(backHref)}
          className="-ml-2 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Button>
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">{entityName} introuvable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — sticky band with breathing room, full-width divider */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:-mx-6 lg:px-6">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <BackButton backHref={backHref} />
          <div className="h-6 w-px shrink-0 bg-border/70" aria-hidden />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badges}
        </div>

        {/* Actions — Save (portal) to the left of the cluster; Delete
            isolated in a "⋯" menu at the far right to avoid a destructive
            missclick next to the save button. */}
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          <HeaderActionsSlot />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Plus d'actions"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuActions?.map((action) => (
                <MenuActionItem
                  key={action.label}
                  icon={action.icon}
                  label={action.label}
                  onSelect={action.onClick}
                  disabled={action.disabled}
                />
              ))}
              {menuActions && menuActions.length > 0 && <DropdownMenuSeparator />}
              <MenuActionItem
                icon={DeleteIcon}
                label="Supprimer"
                onSelect={() => setDeleteOpen(true)}
                destructive
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer {deleteEntityName}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer{" "}
                  <strong>{deleteLabel}</strong> ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isDeleting}
                  className="cursor-pointer"
                >
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs — neat segmented control. With a single tab (single-view sheet),
          the tab bar is hidden and the content renders directly. */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {tabs.length > 1 && (
          <TabsList className="h-9 gap-1 rounded-lg border border-border bg-muted/60 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="cursor-pointer rounded-md px-3.5 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/30 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={tabs.length > 1 ? "mt-6" : ""}
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>

      <UnsavedChangesDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
        description="Si vous quittez cet onglet, vos modifications seront perdues. Voulez-vous vraiment continuer ?"
        cancelLabel="Continuer la saisie"
        onConfirm={() => {
          if (pendingTab) {
            unsaved?.resetDirty();
            applyTabChange(pendingTab);
          }
          setPendingTab(null);
        }}
      />
    </div>
  );
}

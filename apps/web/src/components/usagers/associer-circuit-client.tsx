"use client";

import { useEffect, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  isCircuitCompatibleTransport,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import { dateRangesOverlap } from "@/lib/utils/date-helpers";
import {
  AssociationEditForm,
  CircuitCreateForm,
  CircuitLinkForm,
} from "./associer-circuit/association-forms";
import { CircuitPreviewPanel } from "./associer-circuit/circuit-preview-panel";
import {
  AssociationHeader,
  TransportTypeNotice,
  ModeSwitch,
  AssociationSkeleton,
  AssociationNotFound,
} from "./associer-circuit/page-chrome";
import {
  buildSelectedAddressPoint,
  buildEtablissementPoint,
} from "./associer-circuit/helpers";
import { linkFormSchema, createNewFormSchema } from "./associer-circuit/schemas";
import { useAssociationMutations } from "./associer-circuit/use-association-mutations";
import type {
  LinkFormValues,
  CreateNewFormValues,
} from "./associer-circuit/schemas";
import type {
  CircuitListItem,
  CircuitSuggestion,
  PreviewCircuit,
} from "./associer-circuit/types";

// --- Main client ---

interface AssocierCircuitClientProps {
  usagerId: string;
  usagerCircuitId: string | null;
}

export function AssocierCircuitClient({
  usagerId,
  usagerCircuitId,
}: AssocierCircuitClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const isEdit = !!usagerCircuitId;
  const [mode, setMode] = useState<"existing" | "new">("existing");

  // Render the form on the client only: these fields use useId (FormItem).
  // Rendering them in SSR then hydrating triggers an id mismatch (Next 15.5).
  // In the modal they were already client-only; we reproduce that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: usager, isLoading: usagerLoading } = useQuery(
    trpc.usagers.getById.queryOptions({ id: usagerId }),
  );
  const { data: usagerAddresses } = useQuery(
    trpc.usagerAddresses.list.queryOptions({ usagerId }),
  );
  const { data: allCircuits } = useQuery(trpc.circuits.list.queryOptions());
  const { data: linkedCircuits } = useQuery(
    trpc.usagerCircuits.listByUsager.queryOptions({ usagerId }),
  );
  const { data: etablissements } = useQuery(
    trpc.etablissements.list.queryOptions(),
  );
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    ...trpc.usagerCircuits.suggestForUsager.queryOptions({ usagerId }),
    enabled: !isEdit,
  });

  const linkForm = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      circuitId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });
  const createForm = useForm<CreateNewFormValues>({
    resolver: zodResolver(createNewFormSchema),
    defaultValues: {
      circuitName: "",
      etablissementId: "",
      usagerAddressId: "",
      arrivalNotification: false,
      authorizationAlone: false,
    },
  });

  const editingItem = isEdit
    ? (linkedCircuits?.find((lc) => lc.id === usagerCircuitId) ?? null)
    : null;

  const linkedIds = new Set(linkedCircuits?.map((lc) => lc.circuitId) ?? []);
  const availableCircuits: CircuitListItem[] = (allCircuits ?? [])
    .filter((c) => !linkedIds.has(c.id))
    // We only offer circuits whose validity period overlaps the usager's
    // transport period: a circuit ending before the transport start (or
    // starting after its end) makes no sense for this usager.
    .filter((c) =>
      dateRangesOverlap(
        usager?.transportStartDate,
        usager?.transportEndDate,
        c.startDate,
        c.endDate,
      ),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      etablissementName: c.etablissementName,
      etablissementCity: c.etablissementCity,
      startDate: c.startDate,
      endDate: c.endDate,
      usagerCount: c.usagerCount,
    }));

  // Addresses already assigned to an active circuit: not selectable here
  // (a change goes through an avenant). One assignment per address only.
  const occupiedAddressIds = new Set(
    (linkedCircuits ?? [])
      .map((lc) => lc.usagerAddressId)
      .filter((id): id is string => !!id),
  );
  const hasFreeAddress = (usagerAddresses ?? []).some(
    (a) => !occupiedAddressIds.has(a.id),
  );
  const avenantHref = `/avenants/new?usagerId=${usagerId}`;

  const circuitEligible = isCircuitCompatibleTransport(
    usager?.transportType ?? null,
  );
  const transportTypeLabel = usager?.transportType
    ? USAGER_TRANSPORT_TYPE_LABELS[
        usager.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
      ] ?? usager.transportType
    : null;

  const backToTab = () => router.push(`/usagers/${usagerId}?tab=circuits`);

  const { createMutation, updateMutation, createCircuitMutation, isPending } =
    useAssociationMutations({ usagerId, onSaved: backToTab });

  // Init forms (edit or defaults).
  useEffect(() => {
    if (isEdit) {
      if (editingItem) {
        linkForm.reset({
          circuitId: editingItem.circuitId,
          usagerAddressId: editingItem.usagerAddressId ?? "",
          arrivalNotification: editingItem.arrivalNotification,
          authorizationAlone: editingItem.authorizationAlone,
        });
        setMode("existing");
      }
    } else {
      createForm.reset({
        circuitName: "",
        etablissementId: usager?.etablissementId ?? "",
        usagerAddressId: "",
        arrivalNotification: false,
        authorizationAlone: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editingItem?.id, usager?.etablissementId]);

  // Preselect the best suggestion.
  useEffect(() => {
    if (isEdit || mode !== "existing") return;
    if (linkForm.getValues("circuitId")) return;
    const best = suggestions?.find((s) =>
      availableCircuits.some((c) => c.id === s.circuitId),
    );
    if (best) linkForm.setValue("circuitId", best.circuitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, isEdit, mode, availableCircuits.length]);

  const selectedCircuitId = linkForm.watch("circuitId");
  const suggestionMap = new Map<string, CircuitSuggestion>();
  for (const s of suggestions ?? []) suggestionMap.set(s.circuitId, s);

  const selectedCircuit: PreviewCircuit | null = isEdit
    ? editingItem
      ? {
          id: editingItem.circuitId,
          name: editingItem.circuitName,
          etablissementName: editingItem.etablissementName,
          etablissementCity: editingItem.etablissementCity,
        }
      : null
    : (availableCircuits.find((c) => c.id === selectedCircuitId) ?? null);
  const selectedSuggestion = selectedCircuit
    ? suggestionMap.get(selectedCircuit.id)
    : undefined;

  function switchToExisting() {
    if (mode === "existing") return;
    const v = createForm.getValues();
    linkForm.setValue("usagerAddressId", v.usagerAddressId);
    linkForm.setValue("arrivalNotification", v.arrivalNotification);
    linkForm.setValue("authorizationAlone", v.authorizationAlone);
    setMode("existing");
  }
  function switchToNew() {
    if (mode === "new") return;
    const v = linkForm.getValues();
    createForm.setValue("usagerAddressId", v.usagerAddressId);
    createForm.setValue("arrivalNotification", v.arrivalNotification);
    createForm.setValue("authorizationAlone", v.authorizationAlone);
    setMode("new");
  }

  function onSubmitExisting(values: LinkFormValues) {
    createMutation.mutate({
      usagerId,
      circuitId: values.circuitId,
      usagerAddressId: values.usagerAddressId,
      arrivalNotification: values.arrivalNotification,
      authorizationAlone: values.authorizationAlone,
    });
  }
  async function onSubmitNew(values: CreateNewFormValues) {
    const circuit = await createCircuitMutation.mutateAsync({
      name: values.circuitName,
      etablissementId: values.etablissementId,
      startDate: usager?.transportStartDate || null,
    });
    createMutation.mutate({
      usagerId,
      circuitId: circuit.id,
      usagerAddressId: values.usagerAddressId,
      arrivalNotification: values.arrivalNotification,
      authorizationAlone: values.authorizationAlone,
    });
  }
  function onSubmitEdit(values: LinkFormValues) {
    if (!usagerCircuitId) return;
    updateMutation.mutate({
      id: usagerCircuitId,
      data: {
        usagerAddressId: values.usagerAddressId,
        arrivalNotification: values.arrivalNotification,
        authorizationAlone: values.authorizationAlone,
      },
    });
  }

  const useCreateForm = mode === "new" && !isEdit;

  const ctaLabel = isPending
    ? "Enregistrement..."
    : isEdit
      ? "Enregistrer"
      : useCreateForm
        ? "Créer & associer"
        : "Associer le circuit";

  if (
    !mounted ||
    usagerLoading ||
    !usager ||
    (isEdit && linkedCircuits === undefined)
  ) {
    return <AssociationSkeleton />;
  }

  // Edit link not found.
  if (isEdit && linkedCircuits !== undefined && !editingItem) {
    return <AssociationNotFound onBack={backToTab} />;
  }

  const usagerName = `${usager.firstName} ${usager.lastName}`.trim();
  const subtitle = [usagerName || null, transportTypeLabel]
    .filter(Boolean)
    .join(" · ");

  // --- Geolocated points for the real-time preview (right-hand map) ---
  // Selected address of the current usager (updated on every address card click
  // via watch).
  const watchedAddressId = useCreateForm
    ? createForm.watch("usagerAddressId")
    : linkForm.watch("usagerAddressId");
  const selectedAddressPoint = buildSelectedAddressPoint(
    usagerAddresses ?? [],
    watchedAddressId,
    usagerName,
  );

  // Destination établissement: chosen circuit (existing/edit) or selected
  // établissement (new circuit).
  const previewEtablissementId = isEdit
    ? (allCircuits?.find((c) => c.id === editingItem?.circuitId)
        ?.etablissementId ?? null)
    : useCreateForm
      ? createForm.watch("etablissementId") || null
      : (allCircuits?.find((c) => c.id === selectedCircuitId)?.etablissementId ??
        null);
  const etablissementPoint = buildEtablissementPoint(
    etablissements ?? [],
    previewEtablissementId,
  );

  return (
    // Full width, like the usager detail page (EntityDetailLayout) → consistent UI.
    // `w-full` (without mx-auto) also avoids the flexbox trap: mx-auto on a
    // flex-item of the shell cancelled the stretch and the width jumped with the content.
    <div className="w-full">
      <AssociationHeader
        isEdit={isEdit}
        isPending={isPending}
        submitDisabled={
          isPending || !circuitEligible || (!isEdit && !hasFreeAddress)
        }
        ctaLabel={ctaLabel}
        onBack={backToTab}
      />

      {subtitle && (
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      )}

      {!circuitEligible && (
        <TransportTypeNotice transportTypeLabel={transportTypeLabel} />
      )}

      {/* Segmented (hidden in edit mode) */}
      {!isEdit && (
        <ModeSwitch
          mode={mode}
          onSelectExisting={switchToExisting}
          onSelectNew={switchToNew}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: form */}
        <div className="lg:col-span-2">
          {isEdit ? (
            <AssociationEditForm
              form={linkForm}
              onSubmit={onSubmitEdit}
              circuitName={editingItem?.circuitName}
              usagerId={usagerId}
              addresses={usagerAddresses ?? []}
              occupiedIds={occupiedAddressIds}
              avenantHref={avenantHref}
            />
          ) : useCreateForm ? (
            <CircuitCreateForm
              form={createForm}
              onSubmit={onSubmitNew}
              etablissements={etablissements}
              addresses={usagerAddresses ?? []}
              occupiedIds={occupiedAddressIds}
              avenantHref={avenantHref}
            />
          ) : (
            <CircuitLinkForm
              form={linkForm}
              onSubmit={onSubmitExisting}
              availableCircuits={availableCircuits}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              addresses={usagerAddresses ?? []}
              occupiedIds={occupiedAddressIds}
              avenantHref={avenantHref}
            />
          )}
        </div>

        {/* Right column: preview */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <CircuitPreviewPanel
              circuit={selectedCircuit}
              suggestion={selectedSuggestion}
              isNew={useCreateForm}
              usagerId={usagerId}
              etablissementPoint={etablissementPoint}
              selectedAddressPoint={selectedAddressPoint}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

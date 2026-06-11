import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";
import { USAGER_TRANSPORT_TYPES } from "@/lib/validators/usager";

export const AVENANT_TYPE_LABELS = {
  etablissement: "Établissement",
  circuit: "Circuit",
  jours_pec: "Jours de PEC",
  adresse: "Adresse",
  type_transport: "Type de transport",
  // Created automatically when a usager joins an already-started circuit
  // (see usagerCircuits.create). Not in avenantChangeInputSchema: not entered
  // via the avenant form, only generated server-side.
  ajout: "Ajout d'usager",
} as const;

export type AvenantChangeType = keyof typeof AVENANT_TYPE_LABELS;

export const AVENANT_STATUS_LABELS = {
  actif: "Actif",
  annule: "Annulé",
  // Historical states kept for display compatibility.
  brouillon: "Brouillon",
  planifie: "Planifié",
  applique: "Appliqué",
} as const;

export type AvenantStatus = keyof typeof AVENANT_STATUS_LABELS;

/**
 * One change per usager. The shape depends on the type (discriminated union):
 * - etablissement   : new établissement for the usager (independent of the circuit)
 * - circuit         : re-route the assignment to another circuit (+ address)
 * - jours_pec       : new aller/retour days on the assignment
 * - adresse         : switch the assignment to another address of the usager
 * - type_transport  : change the usager's transport mode; if the new mode is not
 *                     a circuit mode (famille / transport en commun), active
 *                     circuit assignments are closed.
 */
export const avenantChangeInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("etablissement"),
    usagerId: z.string().uuid(),
    etablissementId: z.string().uuid().nullable(),
    secondaryEtablissementId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    type: z.literal("type_transport"),
    usagerId: z.string().uuid(),
    transportType: z.enum(USAGER_TRANSPORT_TYPES),
  }),
  z.object({
    type: z.literal("circuit"),
    usagerId: z.string().uuid(),
    usagerCircuitId: z.string().uuid(),
    circuitId: z.string().uuid(),
    usagerAddressId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("jours_pec"),
    usagerId: z.string().uuid(),
    usagerCircuitId: z.string().uuid(),
    daysAller: z.array(dayEntrySchema),
    daysRetour: z.array(dayEntrySchema),
  }),
  z.object({
    type: z.literal("adresse"),
    usagerId: z.string().uuid(),
    usagerCircuitId: z.string().uuid(),
    usagerAddressId: z.string().uuid(),
  }),
]);

export type AvenantChangeInput = z.infer<typeof avenantChangeInputSchema>;

export const avenantCreateSchema = z.object({
  circuitId: z.string().uuid().nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'effet requise"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  reason: z.string().min(1, "Motif requis").max(1000),
  changes: z.array(avenantChangeInputSchema).min(1, "Au moins un changement"),
});

export type AvenantCreateFormValues = z.infer<typeof avenantCreateSchema>;

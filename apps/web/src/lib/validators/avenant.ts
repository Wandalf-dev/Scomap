import { z } from "zod";
import { dayEntrySchema } from "@/lib/types/day-entry";
import { USAGER_TRANSPORT_TYPES } from "@/lib/validators/usager";

export const AVENANT_TYPE_LABELS = {
  etablissement: "Établissement",
  circuit: "Circuit",
  jours_pec: "Jours de PEC",
  adresse: "Adresse",
  type_transport: "Type de transport",
  // Créé automatiquement quand un usager rejoint un circuit déjà démarré
  // (cf. usagerCircuits.create). Pas dans avenantChangeInputSchema : non saisi
  // via le formulaire d'avenant, uniquement généré côté serveur.
  ajout: "Ajout d'usager",
} as const;

export type AvenantChangeType = keyof typeof AVENANT_TYPE_LABELS;

export const AVENANT_STATUS_LABELS = {
  actif: "Actif",
  annule: "Annulé",
  // États historiques conservés pour compatibilité d'affichage.
  brouillon: "Brouillon",
  planifie: "Planifié",
  applique: "Appliqué",
} as const;

export type AvenantStatus = keyof typeof AVENANT_STATUS_LABELS;

/**
 * Un changement par usager. La forme dépend du type (union discriminée) :
 * - etablissement   : nouvelle école de l'usager (indépendant du circuit)
 * - circuit         : re-router l'affectation vers un autre circuit (+ adresse)
 * - jours_pec       : nouveaux jours aller/retour sur l'affectation
 * - adresse         : basculer l'affectation sur une autre adresse de l'usager
 * - type_transport  : changer le mode de transport de l'usager ; si le nouveau
 *                     mode n'est pas un mode circuit (famille / transport en
 *                     commun), les affectations circuit actives sont clôturées.
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
  reason: z.string().min(1, "Motif requis"),
  changes: z.array(avenantChangeInputSchema).min(1, "Au moins un changement"),
});

export type AvenantCreateFormValues = z.infer<typeof avenantCreateSchema>;

/**
 * Shared trajet/arret synchronisation helpers.
 *
 * Extracted from the usager-circuits router so they can be reused by the
 * avenants feature (which also re-routes usagers between circuits, changes
 * their pickup days/address, etc.). Pure data layer — every function takes a
 * tenant-scoped Ctx and never assumes a request context.
 */
export type TrajetSyncCtx = {
  db: typeof import("@scomap/db").db;
  tenantId: string;
};

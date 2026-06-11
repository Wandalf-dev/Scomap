import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

// Codes dont le message serveur est rédigé pour l'utilisateur (règles métier
// en français dans les routers). Les autres (INTERNAL_SERVER_ERROR…) sont des
// messages techniques : on affiche le fallback.
const ACTIONABLE_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "NOT_FOUND",
  "FORBIDDEN",
  "PRECONDITION_FAILED",
]);

/**
 * Affiche une erreur tRPC en toast : le message métier du serveur quand il est
 * exploitable, sinon le fallback fourni.
 */
export function toastTrpcError(error: unknown, fallback: string) {
  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    const message = error.message;
    // Les erreurs de validation Zod arrivent en BAD_REQUEST avec un JSON brut
    // ([{"code":…}]) : illisible, on garde le fallback.
    if (
      message &&
      !message.startsWith("[") &&
      code &&
      ACTIONABLE_CODES.has(code)
    ) {
      toast.error(message);
      return;
    }
  }
  toast.error(fallback);
}

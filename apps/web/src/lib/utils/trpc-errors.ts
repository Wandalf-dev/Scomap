import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

// Codes whose server message is written for the user (business rules in the
// routers). Others (INTERNAL_SERVER_ERROR…) are technical messages: show the fallback.
const ACTIONABLE_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "NOT_FOUND",
  "FORBIDDEN",
  "PRECONDITION_FAILED",
]);

/**
 * Displays a tRPC error as a toast: the server's business message when it is
 * actionable, otherwise the provided fallback.
 */
export function toastTrpcError(error: unknown, fallback: string) {
  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    const message = error.message;
    // Zod validation errors arrive as BAD_REQUEST with raw JSON
    // ([{"code":…}]): unreadable, so we keep the fallback.
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

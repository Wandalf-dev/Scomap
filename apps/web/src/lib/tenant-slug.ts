/**
 * Extracts the tenant slug from a Host header value (subdomain-based tenancy).
 * Pure string logic, shared between the middleware (edge) and server code.
 */
export function extractTenantSlug(host: string): string | null {
  if (!host.includes(".localhost") && !host.includes(".scomap.")) return null;
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const potentialSubdomain = parts[0]!;
  if (["www", "app", "localhost"].includes(potentialSubdomain)) return null;
  return potentialSubdomain;
}

/**
 * True when the Host header points at the server itself (bind address).
 * Next rewrites Host to this value in renders triggered by a server-action
 * redirect — the only context where x-forwarded-host may be consulted.
 */
export function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("localhost:") ||
    h === "127.0.0.1" ||
    h.startsWith("127.0.0.1:") ||
    h === "[::1]" ||
    h.startsWith("[::1]:") ||
    h === "0.0.0.0" ||
    h.startsWith("0.0.0.0:")
  );
}

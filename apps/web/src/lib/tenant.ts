import { headers } from "next/headers";
import { extractTenantSlug, isLoopbackHost } from "./tenant-slug";

/**
 * Get the current tenant slug from the subdomain
 * Returns null if no tenant (main domain)
 */
export async function getTenantSlug(): Promise<string | null> {
  const headersList = await headers();
  const fromMiddleware = headersList.get("x-tenant-slug");
  if (fromMiddleware) return fromMiddleware;
  // Renders triggered by a server-action redirect don't carry the
  // middleware-injected request headers: re-derive the slug from Host.
  const host = headersList.get("host") ?? "";
  const fromHost = extractTenantSlug(host);
  if (fromHost) return fromHost;
  // In those internal renders Next also rewrites Host to the bind address and
  // only x-forwarded-host keeps the original subdomain. Consult it ONLY in
  // that case: on real requests Host is authoritative, so a client-supplied
  // x-forwarded-host is never trusted over it (anti-spoofing).
  if (isLoopbackHost(host)) {
    return extractTenantSlug(headersList.get("x-forwarded-host") ?? "");
  }
  return null;
}

/**
 * Check if we're on a tenant subdomain
 */
export async function hasTenant(): Promise<boolean> {
  const slug = await getTenantSlug();
  return slug !== null;
}

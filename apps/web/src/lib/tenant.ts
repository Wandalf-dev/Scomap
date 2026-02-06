import { headers } from "next/headers";

/**
 * Get the current tenant slug from the subdomain
 * Returns null if no tenant (main domain)
 */
export async function getTenantSlug(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-tenant-slug");
}

/**
 * Check if we're on a tenant subdomain
 */
export async function hasTenant(): Promise<boolean> {
  const slug = await getTenantSlug();
  return slug !== null;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Clears session cookies and redirects to login. Used when a session is stale
 * or inconsistent with the subdomain (e.g. a JWT predating the addition of
 * tenantSlug): without this purge, the middleware (which only checks for the
 * cookie's presence) would redirect "/" to /dashboard in an infinite loop.
 */
export async function GET(request: NextRequest) {
  // RELATIVE redirect: the browser resolves it against the origin it is on,
  // so the user stays on the tenant subdomain without us trusting any host
  // header (no open-redirect surface; `request.url` is also unusable here —
  // in dev it is normalized to the bind address, localhost:3000).
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: "/" },
  });
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("authjs.session-token") ||
      cookie.name.startsWith("__Secure-authjs.session-token")
    ) {
      // __Secure- prefixed cookies can only be overwritten with the Secure
      // flag — without it, the deletion would silently fail.
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: cookie.name.startsWith("__Secure-"),
      });
    }
  }
  return response;
}

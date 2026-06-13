import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTenantSlug } from "@/lib/tenant-slug";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Extract subdomain (shared logic with lib/tenant.ts)
  const subdomain = extractTenantSlug(host);

  // Set tenant header on the REQUEST so server components can read it via headers()
  // Always strip the incoming value: this header is derived from the Host by the
  // middleware, never supplied by the client (otherwise spoofable on the apex domain)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-slug");
  if (subdomain) {
    requestHeaders.set("x-tenant-slug", subdomain);
  }

  // Light auth check via session cookie (no Node.js imports needed)
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");
  const hasSession = !!sessionCookie;

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/etablissements") ||
    request.nextUrl.pathname.startsWith("/usagers") ||
    request.nextUrl.pathname.startsWith("/circuits") ||
    request.nextUrl.pathname.startsWith("/trajets") ||
    request.nextUrl.pathname.startsWith("/planning") ||
    request.nextUrl.pathname.startsWith("/preparation") ||
    request.nextUrl.pathname.startsWith("/vehicules") ||
    request.nextUrl.pathname.startsWith("/chauffeurs") ||
    request.nextUrl.pathname.startsWith("/utilisateurs") ||
    request.nextUrl.pathname.startsWith("/compte");

  const isAuthRoute =
    request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/signup";

  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)"],
};

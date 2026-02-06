import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Extract subdomain
  let subdomain: string | null = null;

  if (host.includes(".localhost") || host.includes(".scomap.")) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      const potentialSubdomain = parts[0];
      if (!["www", "app", "localhost"].includes(potentialSubdomain)) {
        subdomain = potentialSubdomain;
      }
    }
  }

  // Set tenant header on the REQUEST so server components can read it via headers()
  const requestHeaders = new Headers(request.headers);
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
    request.nextUrl.pathname.startsWith("/vehicules") ||
    request.nextUrl.pathname.startsWith("/chauffeurs") ||
    request.nextUrl.pathname.startsWith("/facturation");

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

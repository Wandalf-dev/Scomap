import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Purge les cookies de session et renvoie au login. Utilisé quand une session
 * est obsolète ou incohérente avec le sous-domaine (ex. JWT antérieur à
 * l'ajout du tenantSlug) : sans cette purge, le middleware (qui ne regarde
 * que la présence du cookie) re-redirigerait "/" vers /dashboard en boucle.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("authjs.session-token") ||
      cookie.name.startsWith("__Secure-authjs.session-token")
    ) {
      // Les cookies préfixés __Secure- ne peuvent être écrasés qu'avec le
      // flag Secure — sans lui, la suppression échouerait silencieusement.
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

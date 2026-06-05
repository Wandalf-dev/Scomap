/**
 * Proxy MapTiler par tenant.
 *
 * MapTiler exige une clé d'API ; le brief impose des clés chiffrées PAR tenant.
 * Une clé `NEXT_PUBLIC_` partagée est donc exclue. Ce proxy injecte la clé du
 * tenant (résolu via la session, jamais via l'URL) côté serveur et réécrit les
 * sous-ressources (style.json, tiles.json, sprite, glyphs) pour que la clé
 * n'apparaisse jamais dans les réponses renvoyées au navigateur.
 */

import { auth } from "@/lib/auth";
import { db } from "@scomap/db";
import { getDecryptedKey } from "@/lib/trpc/services/provider-keys";

export const runtime = "nodejs";

const MAPTILER_BASE = "https://api.maptiler.com/";
const PROXY_PREFIX = "/api/basemap/maptiler/proxy/";

/** Réécrit une URL MapTiler vers le proxy, en retirant la clé. */
function rewriteUrl(u: string): string {
  if (!u.startsWith(MAPTILER_BASE)) return u;
  const rest = u.slice(MAPTILER_BASE.length);
  const [path, query = ""] = rest.split("?");
  const params = new URLSearchParams(query);
  params.delete("key");
  const qs = params.toString();
  return `${PROXY_PREFIX}${path}${qs ? `?${qs}` : ""}`;
}

/** Réécrit récursivement toutes les URLs MapTiler d'un document JSON de style. */
function deepRewrite(value: unknown): unknown {
  if (typeof value === "string") return rewriteUrl(value);
  if (Array.isArray(value)) return value.map(deepRewrite);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        deepRewrite(v),
      ]),
    );
  }
  return value;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return new Response("Unauthorized", { status: 401 });

  const { path } = await params;
  // Défense en profondeur : pas de remontée de chemin (l'hôte reste figé).
  if (path.some((seg) => seg === "..")) {
    return new Response("Bad request", { status: 400 });
  }

  const key = await getDecryptedKey(db, tenantId, "basemap", "maptiler");
  if (!key) return new Response("Clé MapTiler absente", { status: 400 });

  const incoming = new URL(req.url);
  const upstream = new URL(`${MAPTILER_BASE}${path.join("/")}`);
  incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  upstream.searchParams.set("key", key);

  let res: Response;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(20_000) });
  } catch {
    return new Response("MapTiler indisponible", { status: 502 });
  }
  if (!res.ok) {
    return new Response(`MapTiler error (${res.status})`, { status: 502 });
  }

  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";

  // style.json / tiles.json : on réécrit les URLs pour ne pas fuiter la clé.
  if (contentType.includes("json")) {
    const json = await res.json();
    return Response.json(deepRewrite(json), {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // Tuiles / sprites / glyphs : stream binaire.
  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

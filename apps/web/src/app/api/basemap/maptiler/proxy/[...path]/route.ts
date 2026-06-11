/**
 * Per-tenant MapTiler proxy.
 *
 * MapTiler requires an API key; the spec mandates per-tenant encrypted keys.
 * A shared `NEXT_PUBLIC_` key is therefore excluded. This proxy injects the
 * tenant key (resolved via session, never via the URL) server-side and rewrites
 * sub-resources (style.json, tiles.json, sprite, glyphs) so the key never
 * appears in responses sent back to the browser.
 */

import { auth } from "@/lib/auth";
import { db } from "@scomap/db";
import { getDecryptedKey } from "@/lib/trpc/services/provider-keys";

export const runtime = "nodejs";

const MAPTILER_BASE = "https://api.maptiler.com/";
const PROXY_PREFIX = "/api/basemap/maptiler/proxy/";

/** Rewrites a MapTiler URL to go through the proxy, stripping the key. */
function rewriteUrl(u: string): string {
  if (!u.startsWith(MAPTILER_BASE)) return u;
  const rest = u.slice(MAPTILER_BASE.length);
  const [path, query = ""] = rest.split("?");
  const params = new URLSearchParams(query);
  params.delete("key");
  const qs = params.toString();
  return `${PROXY_PREFIX}${path}${qs ? `?${qs}` : ""}`;
}

/** Recursively rewrites all MapTiler URLs found in a style JSON document. */
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
  // Defense in depth: disallow path traversal (the host is kept fixed).
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

  // style.json / tiles.json: rewrite URLs to avoid leaking the key.
  if (contentType.includes("json")) {
    const json = await res.json();
    return Response.json(deepRewrite(json), {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // Tiles / sprites / glyphs: binary stream.
  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

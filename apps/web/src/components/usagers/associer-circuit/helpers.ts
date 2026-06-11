import { ADDRESS_TYPE_LABELS } from "@/lib/validators/usager-address";
import type { PreviewPoint } from "../circuit-preview-map";
import type { EtablissementPoint, SelectedAddressPoint } from "./types";

// "YYYY-MM-DD" → "DD/MM/YYYY".
function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Label for a circuit's validity period depending on the available dates.
export function formatCircuitPeriode(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return "Période non définie";
}

// As-the-crow-flies distance (km) — only used to order the preview points.
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Preview order of the waypoints (nearest-neighbor heuristic): pick up the
 * usagers from the farthest to the closest to the établissement, ending with
 * the établissement ("aller" direction of a school transport). ⚠️ Estimate:
 * the real stop order of a trajet is computed elsewhere (trajet-sync).
 */
export function orderRouteWaypoints(
  points: PreviewPoint[],
): { lat: number; lng: number }[] {
  const geo = points.filter((p) => p.latitude != null && p.longitude != null);
  const etab = geo.find((p) => p.kind === "etablissement");
  const pickups = geo
    .filter((p) => p.kind !== "etablissement")
    .map((p) => ({ lat: p.latitude!, lng: p.longitude! }));
  if (!etab) return pickups;
  const etabLL = { lat: etab.latitude!, lng: etab.longitude! };
  const chain: { lat: number; lng: number }[] = [];
  let cursor = etabLL;
  const rem = [...pickups];
  while (rem.length) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = haversineKm(cursor, rem[i]!);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    cursor = rem[bi]!;
    chain.push(cursor);
    rem.splice(bi, 1);
  }
  chain.reverse(); // établissement last
  return [...chain, etabLL];
}

export function formatKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}
export function formatDuration(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function getAddressTypeLabel(type: string | null): string {
  if (!type) return "";
  return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
}

interface SelectedAddressSource {
  id: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function buildSelectedAddressPoint(
  addresses: SelectedAddressSource[],
  watchedAddressId: string,
  usagerName: string,
): SelectedAddressPoint | null {
  const selAddr = addresses.find((a) => a.id === watchedAddressId);
  return selAddr && selAddr.latitude != null && selAddr.longitude != null
    ? {
        label: `${usagerName || "Usager"}${
          [selAddr.address, selAddr.city].filter(Boolean).length
            ? ` — ${[selAddr.address, selAddr.city].filter(Boolean).join(", ")}`
            : ""
        }`,
        latitude: selAddr.latitude,
        longitude: selAddr.longitude,
      }
    : null;
}

interface EtablissementSource {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export function buildEtablissementPoint(
  etablissements: EtablissementSource[],
  etablissementId: string | null,
): EtablissementPoint | null {
  const previewEtab = etablissements.find((e) => e.id === etablissementId);
  return previewEtab &&
    previewEtab.latitude != null &&
    previewEtab.longitude != null
    ? {
        name: previewEtab.name,
        latitude: previewEtab.latitude,
        longitude: previewEtab.longitude,
      }
    : null;
}

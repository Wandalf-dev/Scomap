// Circuit suggestions for a usager.
//
// The project does not use PostGIS: distances are computed in JavaScript
// from lat/lng coordinates (addresses, arrêts) and trajet routes
// (routeGeometry, a GeoJSON polyline of [lng, lat] pairs).
//
// Two distinct signals, matching the two reasons shown to the user:
//  1. "Same établissement" — relevance: a circuit serves ONE destination
//     établissement, and the usager goes to theirs. This is the base condition.
//  2. "Trajet optimisation" — the circuit route passes near the home:
//     adding the usager costs little detour. This breaks ties between circuits
//     serving the same établissement.

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points (metres). */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance from a point to segment [A, B] (metres), via a local equirectangular
 * projection centred on the point — accuracy is more than sufficient at
 * département scale.
 */
function pointToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(toRad(pLat));
  // Local metric coordinate system centred on P (origin).
  const ax = (aLng - pLng) * mPerDegLng;
  const ay = (aLat - pLat) * mPerDegLat;
  const bx = (bLng - pLng) * mPerDegLng;
  const by = (bLat - pLat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/** Minimum distance from a point to a polyline ([lng, lat] pairs) in metres. */
export function pointToPolylineMeters(
  pLat: number,
  pLng: number,
  coords: number[][],
): number {
  let min = Infinity;
  for (let i = 0; i + 1 < coords.length; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const d = pointToSegmentMeters(pLat, pLng, a[1]!, a[0]!, b[1]!, b[0]!);
    if (d < min) min = d;
    if (min === 0) break;
  }
  return min;
}

export interface SuggestionAddress {
  lat: number;
  lng: number;
  /** Human-readable label (e.g. "Mère", "Adresse 2") for the explanation. */
  label: string;
}

export interface CandidateCircuit {
  id: string;
  etablissementId: string | null;
  /** Polylines [lng, lat][] of the circuit's trajets (empty if not computed). */
  routes: number[][][];
  /** Existing usager arrêts (coordinates). */
  stops: { lat: number; lng: number }[];
}

export interface SuggestionContext {
  etablissementId: string | null;
  secondaryEtablissementId: string | null;
  addresses: SuggestionAddress[];
}

export type SuggestionReasonKind = "etablissement" | "trajet" | "arret";

export interface SuggestionReason {
  kind: SuggestionReasonKind;
  label: string;
  detail: string;
  distanceM?: number;
}

export interface ScoredCircuitSuggestion {
  circuitId: string;
  score: number;
  reasons: SuggestionReason[];
}

// Scoring weights.
const SCORE_ETAB_PRIMARY = 60;
const SCORE_ETAB_SECONDARY = 45;
const SCORE_STOP_SHARE = 12; // bonus « arrêt mutualisable »
const STOP_SHARE_MAX_M = 150;
/** Minimum score for a circuit to be presented as "suggested". */
const SUGGESTION_THRESHOLD = 20;

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 10) * 10} m`;
}

/** Home↔(route|arrêt) proximity tiers: score + label based on the source. */
const PROXIMITY_LEVELS: {
  maxM: number;
  score: number;
  route: string;
  stop: string;
}[] = [
  { maxM: 150, score: 40, route: "Domicile sur le tracé", stop: "Arrêt au domicile" },
  { maxM: 400, score: 32, route: "Tracé très proche", stop: "Arrêt très proche" },
  { maxM: 800, score: 24, route: "Tracé proche", stop: "Arrêt proche" },
  { maxM: 1500, score: 14, route: "Tracé à proximité", stop: "Arrêt à proximité" },
  { maxM: 3000, score: 6, route: "Dans le secteur", stop: "Arrêt dans le secteur" },
];

function proximityLevel(
  m: number,
): { score: number; route: string; stop: string } | null {
  return PROXIMITY_LEVELS.find((l) => m <= l.maxM) ?? null;
}

export function scoreCircuitForUsager(
  ctx: SuggestionContext,
  circuit: CandidateCircuit,
): ScoredCircuitSuggestion {
  const reasons: SuggestionReason[] = [];
  let score = 0;

  // 1. Etablissement (relevance).
  if (ctx.etablissementId && circuit.etablissementId === ctx.etablissementId) {
    score += SCORE_ETAB_PRIMARY;
    reasons.push({
      kind: "etablissement",
      label: "Même établissement",
      detail: "Le circuit dessert l'établissement de l'usager.",
    });
  } else if (
    ctx.secondaryEtablissementId &&
    circuit.etablissementId === ctx.secondaryEtablissementId
  ) {
    score += SCORE_ETAB_SECONDARY;
    reasons.push({
      kind: "etablissement",
      label: "Établissement secondaire",
      detail: "Le circuit dessert l'établissement secondaire de l'usager.",
    });
  }

  // 2. Route proximity (optimisation) — best address × best route.
  // Non-finite distances (NaN coordinates, route without a valid segment)
  // are ignored: otherwise a first NaN/Infinity iteration would "poison" the
  // min reduction (every subsequent comparison `x < NaN` is false).
  let bestRoute: { m: number; addr: SuggestionAddress } | null = null;
  for (const addr of ctx.addresses) {
    for (const route of circuit.routes) {
      if (route.length < 2) continue;
      const m = pointToPolylineMeters(addr.lat, addr.lng, route);
      if (!Number.isFinite(m)) continue;
      if (!bestRoute || m < bestRoute.m) bestRoute = { m, addr };
    }
  }

  // 3. Proximity to an existing arrêt (pooling / fallback when no route).
  let bestStop: { m: number; addr: SuggestionAddress } | null = null;
  for (const addr of ctx.addresses) {
    for (const stop of circuit.stops) {
      const m = haversineMeters(addr.lat, addr.lng, stop.lat, stop.lng);
      if (!Number.isFinite(m)) continue;
      if (!bestStop || m < bestStop.m) bestStop = { m, addr };
    }
  }

  // Primary proximity signal: the closer of route and arrêt (not "route first"),
  // to avoid hiding a much closer arrêt when the route is distant, absent,
  // or geometrically invalid.
  const primary =
    bestRoute && (!bestStop || bestRoute.m <= bestStop.m) ? bestRoute : bestStop;
  const usingRoute = primary !== null && primary === bestRoute;
  if (primary) {
    const level = proximityLevel(primary.m);
    if (level) {
      score += level.score;
      reasons.push({
        kind: usingRoute ? "trajet" : "arret",
        label: usingRoute ? level.route : level.stop,
        detail: usingRoute
          ? `Optimisation : le tracé passe à ~${formatDistance(primary.m)} du domicile (${primary.addr.label}), peu de détour à prévoir.`
          : `Un arrêt existant est à ~${formatDistance(primary.m)} du domicile (${primary.addr.label}).`,
        distanceM: Math.round(primary.m),
      });
    }
  }

  // "Shareable arrêt" bonus only when the route is the primary signal
  // (otherwise the arrêt is already credited as primary proximity → double count).
  if (usingRoute && bestStop && bestStop.m <= STOP_SHARE_MAX_M) {
    score += SCORE_STOP_SHARE;
    reasons.push({
      kind: "arret",
      label: "Arrêt mutualisable",
      detail: `Un arrêt existant est à ~${formatDistance(bestStop.m)} du domicile (${bestStop.addr.label}) — il pourrait être partagé.`,
      distanceM: Math.round(bestStop.m),
    });
  }

  return {
    circuitId: circuit.id,
    score: Math.min(100, Math.round(score)),
    reasons,
  };
}

/** Scores all candidate circuits and keeps only the suggestions, sorted. */
export function suggestCircuits(
  ctx: SuggestionContext,
  candidates: CandidateCircuit[],
): ScoredCircuitSuggestion[] {
  return candidates
    .map((c) => scoreCircuitForUsager(ctx, c))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD && s.reasons.length > 0)
    .sort((a, b) => b.score - a.score);
}

// Suggestions de circuits pour un usager.
//
// Le projet n'utilise pas PostGIS : les distances sont calculées en JavaScript
// à partir des coordonnées lat/lng (adresses, arrêts) et des tracés des trajets
// (routeGeometry, une polyligne GeoJSON de paires [lng, lat]).
//
// Deux signaux distincts, qui correspondent aux deux raisons exposées à
// l'utilisateur :
//  1. « Même établissement » — pertinence : un circuit dessert UN établissement
//     de destination, l'usager va au sien. C'est la condition de base.
//  2. « Optimisation du trajet » — le tracé du circuit passe près du domicile :
//     l'ajouter coûte peu de détour. C'est ce qui départage les circuits d'un
//     même établissement.

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance grand-cercle entre deux points (mètres). */
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
 * Distance d'un point au segment [A, B] (mètres), via une projection
 * équirectangulaire locale centrée sur le point — précision largement
 * suffisante à l'échelle d'un département.
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
  // Repère local métrique centré sur P (origine).
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

/** Distance minimale d'un point à une polyligne (paires [lng, lat]) en mètres. */
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
  /** Libellé lisible (ex. « Mère », « Adresse 2 ») pour l'explication. */
  label: string;
}

export interface CandidateCircuit {
  id: string;
  etablissementId: string | null;
  /** Polylignes [lng, lat][] des trajets du circuit (vide si non calculé). */
  routes: number[][][];
  /** Arrêts usager existants (coordonnées). */
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

// Poids du scoring.
const SCORE_ETAB_PRIMARY = 60;
const SCORE_ETAB_SECONDARY = 45;
const SCORE_STOP_SHARE = 12; // bonus « arrêt mutualisable »
const STOP_SHARE_MAX_M = 150;
/** Score minimal pour qu'un circuit soit présenté comme « suggéré ». */
const SUGGESTION_THRESHOLD = 20;

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m / 10) * 10} m`;
}

/** Paliers de proximité domicile↔(tracé|arrêt) : score + libellé selon la source. */
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

  // 1. Établissement (pertinence).
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

  // 2. Proximité du tracé (optimisation) — meilleure adresse × meilleur tracé.
  // On ignore les distances non finies (coordonnées NaN, tracé sans segment
  // valide) : sinon une première itération NaN/Infinity « empoisonnerait » la
  // réduction min (toute comparaison ultérieure `x < NaN` est fausse).
  let bestRoute: { m: number; addr: SuggestionAddress } | null = null;
  for (const addr of ctx.addresses) {
    for (const route of circuit.routes) {
      if (route.length < 2) continue;
      const m = pointToPolylineMeters(addr.lat, addr.lng, route);
      if (!Number.isFinite(m)) continue;
      if (!bestRoute || m < bestRoute.m) bestRoute = { m, addr };
    }
  }

  // 3. Proximité d'un arrêt existant (mutualisation / repli si pas de tracé).
  let bestStop: { m: number; addr: SuggestionAddress } | null = null;
  for (const addr of ctx.addresses) {
    for (const stop of circuit.stops) {
      const m = haversineMeters(addr.lat, addr.lng, stop.lat, stop.lng);
      if (!Number.isFinite(m)) continue;
      if (!bestStop || m < bestStop.m) bestStop = { m, addr };
    }
  }

  // Signal de proximité principal : le plus proche entre tracé et arrêt (et non
  // « le tracé d'abord »), pour ne pas masquer un arrêt bien plus proche quand
  // le tracé est lointain, absent ou géométriquement invalide.
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

  // Bonus « arrêt mutualisable » uniquement si le tracé est le signal principal
  // (sinon l'arrêt est déjà crédité comme proximité principale → double compte).
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

/** Score tous les circuits candidats et ne garde que les suggestions, triées. */
export function suggestCircuits(
  ctx: SuggestionContext,
  candidates: CandidateCircuit[],
): ScoredCircuitSuggestion[] {
  return candidates
    .map((c) => scoreCircuitForUsager(ctx, c))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD && s.reasons.length > 0)
    .sort((a, b) => b.score - a.score);
}

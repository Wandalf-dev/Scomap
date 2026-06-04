/**
 * Calcul de distance routière entre deux points (lat/lng).
 *
 * Utilise le service public OSRM (profil "driving"), sans clé d'API.
 * Note : le serveur de démo OSRM convient pour le dev / MVP ; pour la
 * production, héberger une instance OSRM/Valhalla ou passer par
 * OpenRouteService (clé requise). Le point d'entrée est isolé ici pour
 * pouvoir changer de fournisseur sans toucher au reste du code.
 */

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Renvoie la distance routière en kilomètres (arrondie à 0,1 km),
 * ou `null` si le calcul échoue (service indisponible, pas d'itinéraire…).
 */
export async function computeRoadDistanceKm(
  from: LatLng,
  to: LatLng,
): Promise<number | null> {
  // OSRM attend l'ordre lng,lat.
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=false&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Évite de bloquer trop longtemps si OSRM ne répond pas.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code?: string;
      routes?: { distance?: number }[];
    };
    if (data.code !== "Ok") return null;

    const meters = data.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters)) return null;

    return Math.round((meters / 1000) * 10) / 10;
  } catch {
    return null;
  }
}

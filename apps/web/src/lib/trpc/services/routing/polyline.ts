/**
 * Google Encoded Polyline decoder, precision 5 (factor 1e5).
 * Output in `[lng, lat]` (GeoJSON/MapLibre order).
 *
 * ⚠️ Precision 5 only (Google Routes API). DO NOT use for
 * OSRM polyline6 geometries (factor 1e6).
 */
export function decodePolyline5(str: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const out: [number, number][] = [];

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    out.push([lng / 1e5, lat / 1e5]);
  }

  return out;
}

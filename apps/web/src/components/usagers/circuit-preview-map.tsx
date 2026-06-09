"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { BasemapStyle } from "@/lib/maps/basemap-types";

export type PreviewPointKind = "etablissement" | "selected" | "usager";

export interface PreviewPoint {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  kind: PreviewPointKind;
}

const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Couleur + taille du pin par catégorie. On utilise l'épingle MapLibre par
// défaut (teardrop) : sa POINTE est ancrée précisément sur la coordonnée — bien
// plus lisible qu'un gros disque centré. L'adresse choisie est légèrement plus
// grande pour ressortir. Cohérent avec components/shared/point-map.tsx.
const MARKER: Record<PreviewPointKind, { color: string; scale: number }> = {
  etablissement: { color: "#2563eb", scale: 0.85 }, // bleu
  selected: { color: "#059669", scale: 1 }, // vert émeraude (bien distinct du bleu)
  usager: { color: "#d97706", scale: 0.75 }, // orange
};

// Distance haversine en mètres entre deux [lng, lat].
function distMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Point le plus proche d'une coordonnée sur une polyligne (projection planaire
// locale, suffisante sur de courtes distances). Sert à tracer le « dernier
// mètre » entre un pin (coordonnée exacte) et la route (rabattue par le moteur).
function nearestOnLine(
  p: [number, number],
  line: [number, number][],
): [number, number] {
  const kx = Math.cos((p[1] * Math.PI) / 180);
  const px = p[0] * kx;
  const py = p[1];
  let best: [number, number] = line[0]!;
  let bestD2 = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const ax = a[0] * kx;
    const ay = a[1];
    const dx = b[0] * kx - ax;
    const dy = b[1] - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    }
  }
  return best;
}

/**
 * Carte d'aperçu temps réel des points d'un circuit en cours d'association :
 * établissement de destination + usagers déjà sur le circuit + adresse choisie
 * (mise à jour à chaque changement de sélection, sans recréer la carte).
 */
export function CircuitPreviewMap({
  points,
  routeGeometry,
  basemap,
  className,
}: {
  points: PreviewPoint[];
  /** Tracé d'aperçu en `[lng, lat][]` (ordre GeoJSON). Dessiné sous les pins. */
  routeGeometry?: [number, number][];
  basemap?: BasemapStyle;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  const geoPoints = useMemo(
    () => points.filter((p) => p.latitude != null && p.longitude != null),
    [points],
  );
  const pointsKey = useMemo(
    () =>
      JSON.stringify(
        geoPoints.map((p) => [p.id, p.kind, p.latitude, p.longitude, p.label]),
      ),
    [geoPoints],
  );
  const basemapKey = useMemo(() => JSON.stringify(basemap ?? null), [basemap]);
  // Signature peu coûteuse du tracé (longueur + extrémités) — évite de
  // sérialiser ~1000 points à chaque rendu.
  const routeKey = useMemo(() => {
    if (!routeGeometry || routeGeometry.length < 2) return "none";
    const a = routeGeometry[0]!;
    const b = routeGeometry[routeGeometry.length - 1]!;
    return `${routeGeometry.length}:${a[0]},${a[1]}:${b[0]},${b[1]}`;
  }, [routeGeometry]);

  // Init : une seule carte par fond de carte (remontée seulement si le provider
  // du tenant change). Les marqueurs sont gérés par l'effet suivant.
  useEffect(() => {
    if (!containerRef.current) return;
    const style: string | StyleSpecification =
      basemap?.kind === "rasterStyle"
        ? (basemap.style as StyleSpecification)
        : (basemap?.url ?? FALLBACK_STYLE);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [2.4, 46.6], // centre France par défaut ; recadré via fitBounds
      zoom: 4,
    });
    mapRef.current = map;
    setLoaded(false);
    map.on("load", () => {
      setLoaded(true);
      // Le conteneur peut avoir été mesuré à 0 au moment de l'init (layout pas
      // encore flush / panneau sticky) → canvas blanc. On force un recalcul.
      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemapKey]);

  // Marqueurs : recalculés à chaque changement de points (temps réel), sans
  // recréer la carte — on retire les anciens marqueurs et on recadre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (geoPoints.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const p of geoPoints) {
      const s = MARKER[p.kind];
      const marker = new maplibregl.Marker({ color: s.color, scale: s.scale })
        .setLngLat([p.longitude!, p.latitude!])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText(p.label))
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.longitude!, p.latitude!]);
    }

    if (geoPoints.length === 1) {
      map.easeTo({
        center: [geoPoints[0]!.longitude!, geoPoints[0]!.latitude!],
        zoom: 13,
      });
    } else {
      map.fitBounds(bounds, { padding: 44, maxZoom: 15, duration: 400 });
    }
  }, [pointsKey, loaded, geoPoints]);

  // Tracé : couche GeoJSON sous les marqueurs (pins HTML toujours au-dessus du
  // canvas). Recréée à chaque changement de géométrie ; retirée si plus de tracé.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "preview-route";
    if (map.getLayer(SRC)) map.removeLayer(SRC);
    if (map.getSource(SRC)) map.removeSource(SRC);
    if (routeGeometry && routeGeometry.length >= 2) {
      map.addSource(SRC, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeGeometry },
        },
      });
      map.addLayer({
        id: SRC,
        type: "line",
        source: SRC,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#7c3aed", "line-width": 3.5, "line-opacity": 0.85 },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, loaded]);

  // Connecteurs « derniers mètres » : pointillé entre chaque pin (coordonnée
  // exacte) et le point le plus proche du tracé (rabattu sur la route). Affiché
  // seulement au-delà de 20 m, donc visible surtout pour l'établissement/adresses
  // en retrait — invisible pour les points déjà sur la voie.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "preview-connectors";
    if (map.getLayer(SRC)) map.removeLayer(SRC);
    if (map.getSource(SRC)) map.removeSource(SRC);
    if (!routeGeometry || routeGeometry.length < 2 || geoPoints.length === 0)
      return;
    const features = geoPoints
      .map((p) => {
        const marker: [number, number] = [p.longitude!, p.latitude!];
        const onRoute = nearestOnLine(marker, routeGeometry);
        if (distMeters(marker, onRoute) <= 20) return null;
        return {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [marker, onRoute],
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    if (features.length === 0) return;
    map.addSource(SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });
    map.addLayer({
      id: SRC,
      type: "line",
      source: SRC,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#7c3aed",
        "line-width": 2,
        "line-opacity": 0.55,
        "line-dasharray": [1.5, 1.5],
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, pointsKey, loaded]);

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Conteneur en hauteur réelle (h-full) et non absolute : MapLibre mesure
          ainsi correctement le conteneur à l'init (sinon canvas blanc). */}
      <div ref={containerRef} className="h-full w-full" />
      {geoPoints.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          Sélectionnez une adresse pour prévisualiser les points.
        </div>
      )}
    </div>
  );
}

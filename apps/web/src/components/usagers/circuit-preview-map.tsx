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

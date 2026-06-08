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

// Styles de marqueur par catégorie : établissement (bleu, destination), adresse
// choisie de l'usager courant (indigo, mise en avant), autres usagers (ambre).
const MARKER: Record<
  PreviewPointKind,
  { bg: string; size: number; zIndex: string }
> = {
  etablissement: { bg: "#2563eb", size: 28, zIndex: "2" },
  selected: { bg: "#4f46e5", size: 30, zIndex: "3" },
  usager: { bg: "#d97706", size: 20, zIndex: "1" },
};

/**
 * Carte d'aperçu temps réel des points d'un circuit en cours d'association :
 * établissement de destination + usagers déjà sur le circuit + adresse choisie
 * (mise à jour à chaque changement de sélection, sans recréer la carte).
 */
export function CircuitPreviewMap({
  points,
  basemap,
  className,
}: {
  points: PreviewPoint[];
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
    map.on("load", () => setLoaded(true));

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
      const el = document.createElement("div");
      el.style.cssText = `
        width:${s.size}px;height:${s.size}px;border-radius:50%;
        background:${s.bg};border:2px solid white;
        box-shadow:0 2px 4px rgba(0,0,0,.3);z-index:${s.zIndex};cursor:pointer;
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.longitude!, p.latitude!])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(p.label))
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

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {geoPoints.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          Sélectionnez une adresse pour prévisualiser les points.
        </div>
      )}
    </div>
  );
}

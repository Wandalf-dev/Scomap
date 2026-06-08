"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { BasemapStyle } from "@/lib/maps/basemap-types";

const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

interface PointMapProps {
  latitude: number;
  longitude: number;
  /** Texte du popup (au clic sur l'épingle). */
  label?: string;
  basemap?: BasemapStyle;
  zoom?: number;
  className?: string;
}

/**
 * Carte centrée sur un point unique, avec une épingle MapLibre (teardrop) qui
 * pointe précisément sur la position — pour vérifier une adresse géolocalisée.
 */
export function PointMap({
  latitude,
  longitude,
  label,
  basemap,
  zoom = 15,
  className,
}: PointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const basemapKey = JSON.stringify(basemap ?? null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) mapRef.current.remove();

    const style: string | StyleSpecification =
      basemap?.kind === "rasterStyle"
        ? (basemap.style as StyleSpecification)
        : (basemap?.url ?? FALLBACK_STYLE);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [longitude, latitude],
      zoom,
    });
    mapRef.current = map;

    map.on("load", () => {
      const marker = new maplibregl.Marker({ color: "#2563eb" }).setLngLat([
        longitude,
        latitude,
      ]);
      if (label) {
        marker.setPopup(new maplibregl.Popup({ offset: 28 }).setText(label));
      }
      marker.addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, zoom, basemapKey]);

  return (
    <div
      ref={containerRef}
      className={`rounded-[0.3rem] border border-border ${className ?? ""}`}
    />
  );
}

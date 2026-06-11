"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StyleSpecification } from "maplibre-gl";
import type { BasemapStyle } from "@/lib/maps/basemap-types";

const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Délai au-delà duquel un style/des tuiles qui ne répondent pas sont
// considérés en échec (réseau coupé, provider down).
const LOAD_TIMEOUT_MS = 15000;

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
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  // Incrémenté par « Réessayer » pour relancer l'init complète de la carte.
  const [attempt, setAttempt] = useState(0);
  const basemapKey = JSON.stringify(basemap ?? null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) mapRef.current.remove();
    setStatus("loading");

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

    let loaded = false;
    const timeout = setTimeout(() => {
      if (!loaded) setStatus("error");
    }, LOAD_TIMEOUT_MS);

    // Erreur fatale uniquement avant le premier rendu (style indisponible) ;
    // les erreurs de tuiles isolées après le `load` sont ignorées.
    map.on("error", () => {
      if (!loaded) {
        clearTimeout(timeout);
        setStatus("error");
      }
    });

    map.on("load", () => {
      loaded = true;
      clearTimeout(timeout);
      setStatus("ready");

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
      clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, zoom, basemapKey, attempt]);

  return (
    <div
      className={`relative overflow-hidden rounded-[0.3rem] border border-border ${className ?? ""}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/40">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted px-6 text-center">
          <MapPinOff className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Impossible de charger la carte
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}

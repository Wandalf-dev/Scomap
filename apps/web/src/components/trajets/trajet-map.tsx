"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StyleSpecification } from "maplibre-gl";
import type { BasemapStyle } from "@/lib/maps/basemap-types";

interface Stop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  orderIndex: number;
  type: string | null;
}

interface RouteGeometry {
  type: "LineString";
  coordinates: number[][];
}

interface TrajetMapProps {
  arrets: Stop[];
  routeGeometry?: RouteGeometry;
  basemap?: BasemapStyle;
  className?: string;
}

const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Délai au-delà duquel un style/des tuiles qui ne répondent pas sont
// considérés en échec (réseau coupé, provider down).
const LOAD_TIMEOUT_MS = 15000;

export function TrajetMap({
  arrets,
  routeGeometry,
  basemap,
  className,
}: TrajetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  // Incrémenté par « Réessayer » pour relancer l'init complète de la carte.
  const [attempt, setAttempt] = useState(0);

  const geoArrets = arrets.filter(
    (a) => a.latitude != null && a.longitude != null,
  );

  const geoArretsKey = useMemo(
    () => JSON.stringify(geoArrets.map((a) => [a.id, a.latitude, a.longitude])),
    [geoArrets],
  );
  const geometryKey = routeGeometry ? routeGeometry.coordinates.length : 0;
  // Le fond de carte étant changé via remontage complet (cf. deps), on en fait
  // une clé stable pour relancer l'effet quand le tenant change de provider.
  const basemapKey = useMemo(() => JSON.stringify(basemap ?? null), [basemap]);

  useEffect(() => {
    if (!containerRef.current || geoArrets.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }
    setStatus("loading");

    const style: string | StyleSpecification =
      basemap?.kind === "rasterStyle"
        ? (basemap.style as StyleSpecification)
        : (basemap?.url ?? FALLBACK_STYLE);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [geoArrets[0]!.longitude!, geoArrets[0]!.latitude!],
      zoom: 12,
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

      geoArrets.forEach((arret) => {
        const el = document.createElement("div");
        el.className = "trajet-marker";
        el.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: ${arret.type === "etablissement" ? "#2563eb" : "#B45309"};
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        el.textContent = String(arret.orderIndex + 1);

        new maplibregl.Marker({ element: el })
          .setLngLat([arret.longitude!, arret.latitude!])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setText(
              `${arret.orderIndex + 1}. ${arret.name}`,
            ),
          )
          .addTo(map);
      });

      // Draw the route only when a real itinerary has been calculated.
      // No straight-line fallback: a straight line looks like a route but isn't.
      const routeCoords = routeGeometry?.coordinates ?? null;

      if (routeCoords && routeCoords.length >= 2) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeCoords,
            },
          },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#B45309",
            "line-width": 3,
            "line-opacity": 0.8,
          },
        });

        // Fit bounds to route geometry for better framing
        const bounds = new maplibregl.LngLatBounds();
        routeCoords.forEach((c: number[]) => bounds.extend(c as [number, number]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      } else if (geoArrets.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        geoArrets.forEach((a) => bounds.extend([a.longitude!, a.latitude!]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    });

    return () => {
      clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoArretsKey, geometryKey, basemapKey, attempt]);

  if (geoArrets.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 bg-muted/30 text-sm text-muted-foreground ${className ?? ""}`}
      >
        Aucun arrêt avec coordonnées GPS
      </div>
    );
  }

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

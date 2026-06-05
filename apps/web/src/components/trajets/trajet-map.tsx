"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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

export function TrajetMap({
  arrets,
  routeGeometry,
  basemap,
  className,
}: TrajetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    map.on("load", () => {
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
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoArretsKey, geometryKey, basemapKey]);

  if (geoArrets.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[0.3rem] border border-dashed border-muted-foreground/25 bg-muted/30 text-sm text-muted-foreground ${className ?? ""}`}
      >
        Aucun arret avec coordonnees GPS
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-[0.3rem] border border-border ${className ?? ""}`}
    />
  );
}

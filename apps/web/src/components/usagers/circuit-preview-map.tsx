"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Timeout beyond which an unresponsive style/tiles are considered failed
// (network down, provider down).
const LOAD_TIMEOUT_MS = 15000;

// Color + size of the pin per category. We use the default MapLibre teardrop
// marker: its TIP is anchored precisely on the coordinate — much more readable
// than a large centered disc. The chosen address is slightly larger to stand out.
// Consistent with components/shared/point-map.tsx.
const MARKER: Record<PreviewPointKind, { color: string; scale: number }> = {
  etablissement: { color: "#2563eb", scale: 0.85 }, // blue
  selected: { color: "#059669", scale: 1 }, // emerald green (clearly distinct from blue)
  usager: { color: "#d97706", scale: 0.75 }, // orange
};

// White chevron with a purple outline (canvas), pointing UP (north). It will be
// rotated by `icon-rotate` according to the bearing of each arrow → points in the
// direction of travel.
function buildArrowImage(): ImageData | null {
  if (typeof document === "undefined") return null;
  const ratio = 2;
  const s = 22;
  const canvas = document.createElement("canvas");
  canvas.width = s * ratio;
  canvas.height = s * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(ratio, ratio);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const chevron = () => {
    ctx.beginPath();
    ctx.moveTo(s * 0.26, s * 0.62);
    ctx.lineTo(s * 0.5, s * 0.36);
    ctx.lineTo(s * 0.74, s * 0.62);
    ctx.stroke();
  };
  ctx.strokeStyle = "rgba(76,29,149,0.95)"; // dark purple outline (contrast)
  ctx.lineWidth = 5;
  chevron();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  chevron();
  return ctx.getImageData(0, 0, s * ratio, s * ratio);
}

// Haversine distance (m) between two [lng, lat] points.
function distMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]);
  const dLng = toR(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Compass bearing (deg, 0 = north, clockwise) from a to b.
function bearingDeg(a: [number, number], b: [number, number]): number {
  const toR = (x: number) => (x * Math.PI) / 180;
  const toD = (x: number) => (x * 180) / Math.PI;
  const dLng = toR(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(toR(b[1]));
  const x =
    Math.cos(toR(a[1])) * Math.sin(toR(b[1])) -
    Math.sin(toR(a[1])) * Math.cos(toR(b[1])) * Math.cos(dLng);
  return (toD(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Direction arrows at FIXED geographic positions along the route (≈ every 1.2 km,
 * 1 to 6 arrows), each with its own bearing. Stable positions → unlike
 * `symbol-placement: line`, they don't recompute on zoom (no arrows multiplying /
 * disappearing).
 */
function buildArrowFeatures(line: [number, number][]) {
  if (!line || line.length < 2) return [];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = distMeters(line[i - 1]!, line[i]!);
    seg.push(d);
    total += d;
  }
  if (total < 1) return [];
  const n = Math.max(1, Math.min(6, Math.round(total / 1200)));
  const feats = [];
  for (let k = 1; k <= n; k++) {
    const target = (total * k) / (n + 1);
    let acc = 0;
    let idx = 0;
    while (idx < seg.length - 1 && acc + seg[idx]! < target) {
      acc += seg[idx]!;
      idx++;
    }
    const a = line[idx]!;
    const b = line[idx + 1] ?? a;
    const t = seg[idx] ? Math.max(0, Math.min(1, (target - acc) / seg[idx]!)) : 0;
    feats.push({
      type: "Feature" as const,
      properties: { bearing: bearingDeg(a, b) },
      geometry: {
        type: "Point" as const,
        coordinates: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
      },
    });
  }
  return feats;
}

/**
 * Real-time preview map of the points of a circuit being associated:
 * destination établissement + usagers already on the circuit + chosen address
 * (updated on every selection change, without recreating the map).
 */
export function CircuitPreviewMap({
  points,
  routeGeometry,
  basemap,
  className,
}: {
  points: PreviewPoint[];
  /** Preview route as `[lng, lat][]` (GeoJSON order). Drawn below the pins. */
  routeGeometry?: [number, number][];
  basemap?: BasemapStyle;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Incremented by "Réessayer" to trigger a full map re-initialization.
  const [attempt, setAttempt] = useState(0);

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
  // Cheap fingerprint of the route (length + endpoints) — avoids serializing
  // ~1000 points on every render.
  const routeKey = useMemo(() => {
    if (!routeGeometry || routeGeometry.length < 2) return "none";
    const a = routeGeometry[0]!;
    const b = routeGeometry[routeGeometry.length - 1]!;
    return `${routeGeometry.length}:${a[0]},${a[1]}:${b[0]},${b[1]}`;
  }, [routeGeometry]);

  // Init: one map per basemap (recreated only if the tenant's provider changes).
  // Markers are managed by the next effect.
  useEffect(() => {
    if (!containerRef.current) return;
    const style: string | StyleSpecification =
      basemap?.kind === "rasterStyle"
        ? (basemap.style as StyleSpecification)
        : (basemap?.url ?? FALLBACK_STYLE);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [2.4, 46.6], // default center of France; reframed via fitBounds
      zoom: 4,
    });
    mapRef.current = map;
    setLoaded(false);
    setLoadError(false);

    let isLoaded = false;
    const timeout = setTimeout(() => {
      if (!isLoaded) setLoadError(true);
    }, LOAD_TIMEOUT_MS);

    // Fatal error only before the first render (style unavailable);
    // isolated tile errors after `load` are ignored.
    map.on("error", () => {
      if (!isLoaded) {
        clearTimeout(timeout);
        setLoadError(true);
      }
    });

    map.on("load", () => {
      isLoaded = true;
      clearTimeout(timeout);
      setLoadError(false);
      setLoaded(true);
      // The container may have been measured at 0 at init time (layout not yet
      // flushed / sticky panel) → white canvas. Force a resize.
      map.resize();
    });

    return () => {
      clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemapKey, attempt]);

  // Markers: recomputed on every point change (real-time), without recreating
  // the map — we remove the old markers and re-fit bounds.
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

  // Route: GeoJSON layer below the markers (HTML pins always above the canvas).
  // Recreated on every geometry change; removed if no more route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "preview-route";
    const ARROWS = "preview-route-arrows";
    const ARROWS_SRC = "preview-route-arrows-src";
    if (map.getLayer(ARROWS)) map.removeLayer(ARROWS);
    if (map.getSource(ARROWS_SRC)) map.removeSource(ARROWS_SRC);
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
      // Direction arrows: FIXED points (stable geo positions at any zoom level),
      // each rotated by its bearing. The image is added only once (survives layer
      // re-renders, not a full map recreation).
      if (!map.hasImage("route-arrow")) {
        const arrow = buildArrowImage();
        if (arrow) map.addImage("route-arrow", arrow, { pixelRatio: 2 });
      }
      const arrowFeatures = buildArrowFeatures(routeGeometry);
      if (map.hasImage("route-arrow") && arrowFeatures.length > 0) {
        map.addSource(ARROWS_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: arrowFeatures },
        });
        map.addLayer({
          id: ARROWS,
          type: "symbol",
          source: ARROWS_SRC,
          layout: {
            "icon-image": "route-arrow",
            "icon-size": 0.85,
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, loaded]);

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Real height container (h-full), not absolute: MapLibre correctly measures
          it at init (otherwise white canvas). */}
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && !loadError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/40">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-muted px-6 text-center">
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
      {loaded && !loadError && geoPoints.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          Sélectionnez une adresse pour prévisualiser les points.
        </div>
      )}
    </div>
  );
}

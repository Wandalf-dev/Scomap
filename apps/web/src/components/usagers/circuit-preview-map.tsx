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

// Délai au-delà duquel un style/des tuiles qui ne répondent pas sont
// considérés en échec (réseau coupé, provider down).
const LOAD_TIMEOUT_MS = 15000;

// Couleur + taille du pin par catégorie. On utilise l'épingle MapLibre par
// défaut (teardrop) : sa POINTE est ancrée précisément sur la coordonnée — bien
// plus lisible qu'un gros disque centré. L'adresse choisie est légèrement plus
// grande pour ressortir. Cohérent avec components/shared/point-map.tsx.
const MARKER: Record<PreviewPointKind, { color: string; scale: number }> = {
  etablissement: { color: "#2563eb", scale: 0.85 }, // bleu
  selected: { color: "#059669", scale: 1 }, // vert émeraude (bien distinct du bleu)
  usager: { color: "#d97706", scale: 0.75 }, // orange
};

// Chevron blanc à liseré violet (canvas), pointant vers le HAUT (nord). Il sera
// tourné par `icon-rotate` selon le cap de chaque flèche → pointe dans le sens
// de circulation.
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
  ctx.strokeStyle = "rgba(76,29,149,0.95)"; // liseré violet foncé (contraste)
  ctx.lineWidth = 5;
  chevron();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  chevron();
  return ctx.getImageData(0, 0, s * ratio, s * ratio);
}

// Distance haversine (m) entre deux [lng, lat].
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

// Cap compas (deg, 0 = nord, sens horaire) de a vers b.
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
 * Flèches de sens à positions géographiques FIXES le long du tracé (≈ 1 / 1,2 km,
 * de 1 à 6), chacune avec son cap. Positions stables → contrairement à
 * `symbol-placement: line`, elles ne se recalculent pas au zoom (plus de flèches
 * qui se multiplient / disparaissent).
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
  const [loadError, setLoadError] = useState(false);
  // Incrémenté par « Réessayer » pour relancer l'init complète de la carte.
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
    setLoadError(false);

    let isLoaded = false;
    const timeout = setTimeout(() => {
      if (!isLoaded) setLoadError(true);
    }, LOAD_TIMEOUT_MS);

    // Erreur fatale uniquement avant le premier rendu (style indisponible) ;
    // les erreurs de tuiles isolées après le `load` sont ignorées.
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
      // Le conteneur peut avoir été mesuré à 0 au moment de l'init (layout pas
      // encore flush / panneau sticky) → canvas blanc. On force un recalcul.
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
      // Flèches de sens : points FIXES (positions géo stables au zoom), chacun
      // tourné selon son cap. L'image n'est ajoutée qu'une fois (survit aux
      // re-rendus de couches, pas à une remontée de carte).
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
      {/* Conteneur en hauteur réelle (h-full) et non absolute : MapLibre mesure
          ainsi correctement le conteneur à l'init (sinon canvas blanc). */}
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

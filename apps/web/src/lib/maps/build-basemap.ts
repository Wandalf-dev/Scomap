/**
 * Builds the MapLibre basemap specification for the provider and style chosen
 * by the tenant. Pure function with no secrets: the MapTiler key never appears
 * here (it is injected by the `/api/basemap/maptiler` proxy).
 */

import type { BasemapStyle, MapStyleSpec } from "./basemap-types";

export type BasemapProviderId =
  | "openfreemap"
  | "osm_raster"
  | "maptiler"
  | "ign";

const OPENFREEMAP_STYLES = ["liberty", "bright", "positron"] as const;
const DEFAULT_MAPTILER_STYLE = "streets-v2";
const DEFAULT_IGN_LAYER = "GEOGRAPHICALGRIDSYSTEMS.PLAN.IGN";

function osmRasterStyle(): MapStyleSpec {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

function ignRasterStyle(layer: string): MapStyleSpec {
  const format = layer.includes("ORTHO") ? "image/jpeg" : "image/png";
  const tile =
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
    `&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${format}` +
    "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
  return {
    version: 8,
    sources: {
      ign: {
        type: "raster",
        tiles: [tile],
        tileSize: 256,
        attribution: "© IGN-F/Géoplateforme",
      },
    },
    layers: [{ id: "ign", type: "raster", source: "ign" }],
  };
}

export function buildBasemapStyle(
  provider: BasemapProviderId,
  styleId: string | null,
): BasemapStyle {
  switch (provider) {
    case "osm_raster":
      return { kind: "rasterStyle", style: osmRasterStyle() };

    case "ign":
      return {
        kind: "rasterStyle",
        style: ignRasterStyle(styleId ?? DEFAULT_IGN_LAYER),
      };

    case "maptiler": {
      // Internal proxy URL (the key is added server-side, never exposed).
      const style = styleId ?? DEFAULT_MAPTILER_STYLE;
      return {
        kind: "styleUrl",
        url: `/api/basemap/maptiler/proxy/maps/${encodeURIComponent(style)}/style.json`,
      };
    }

    case "openfreemap":
    default: {
      const style = OPENFREEMAP_STYLES.includes(
        styleId as (typeof OPENFREEMAP_STYLES)[number],
      )
        ? styleId
        : "liberty";
      return {
        kind: "styleUrl",
        url: `https://tiles.openfreemap.org/styles/${style}`,
      };
    }
  }
}

/**
 * Shared (isomorphic server/client) type describing the resolved basemap for
 * a tenant. Intentionally decoupled from maplibre-gl's `StyleSpecification`
 * so the server (tRPC router) does not need to depend on the rendering lib.
 * The client casts to `StyleSpecification` at point of use.
 */

/** MapLibre style object (loosely typed on the transport layer). */
export type MapStyleSpec = Record<string, unknown>;

export type BasemapStyle =
  | { kind: "styleUrl"; url: string }
  | { kind: "rasterStyle"; style: MapStyleSpec };

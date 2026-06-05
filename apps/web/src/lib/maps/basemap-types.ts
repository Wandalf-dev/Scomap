/**
 * Type partagé (isomorphe serveur/client) décrivant le fond de carte résolu
 * pour un tenant. Volontairement découplé du type `StyleSpecification` de
 * maplibre-gl pour que le serveur (router tRPC) n'ait pas à dépendre de la lib
 * de rendu. Le client caste vers `StyleSpecification` au moment de l'usage.
 */

/** Objet de style MapLibre (typé librement côté transport). */
export type MapStyleSpec = Record<string, unknown>;

export type BasemapStyle =
  | { kind: "styleUrl"; url: string }
  | { kind: "rasterStyle"; style: MapStyleSpec };

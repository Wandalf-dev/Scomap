import { osrmAdapter } from "./osrm";
import { ignAdapter } from "./ign";
import { orsAdapter } from "./openrouteservice";
import { googleAdapter } from "./google";
import type { RoutingAdapter, RoutingProviderId } from "./types";

/** Registre typé des moteurs de routing. Ajouter un provider = une entrée + un adaptateur. */
export const routingAdapters = {
  osrm: osrmAdapter,
  ign: ignAdapter,
  openrouteservice: orsAdapter,
  google: googleAdapter,
} as const satisfies Record<RoutingProviderId, RoutingAdapter>;

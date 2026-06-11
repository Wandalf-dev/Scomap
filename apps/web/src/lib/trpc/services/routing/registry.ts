import { osrmAdapter } from "./osrm";
import { ignAdapter } from "./ign";
import { orsAdapter } from "./openrouteservice";
import { googleAdapter } from "./google";
import type { RoutingAdapter, RoutingProviderId } from "./types";

/** Typed registry of routing engines. Adding a provider = one entry + one adapter. */
export const routingAdapters = {
  osrm: osrmAdapter,
  ign: ignAdapter,
  openrouteservice: orsAdapter,
  google: googleAdapter,
} as const satisfies Record<RoutingProviderId, RoutingAdapter>;

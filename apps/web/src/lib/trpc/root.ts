import { createTRPCRouter, createCallerFactory } from "./init";
import { etablissementsRouter } from "./routers/etablissements";
import { etablissementContactsRouter } from "./routers/etablissement-contacts";
import { usagersRouter } from "./routers/usagers";
import { usagerAddressesRouter } from "./routers/usager-addresses";
import { vehiculesRouter } from "./routers/vehicules";
import { chauffeursRouter } from "./routers/chauffeurs";
import { circuitsRouter } from "./routers/circuits";
import { arretsRouter } from "./routers/arrets";
import { trajetsRouter } from "./routers/trajets";
import { usagerCircuitsRouter } from "./routers/usager-circuits";

export const appRouter = createTRPCRouter({
  etablissements: etablissementsRouter,
  etablissementContacts: etablissementContactsRouter,
  usagers: usagersRouter,
  usagerAddresses: usagerAddressesRouter,
  vehicules: vehiculesRouter,
  chauffeurs: chauffeursRouter,
  circuits: circuitsRouter,
  arrets: arretsRouter,
  trajets: trajetsRouter,
  usagerCircuits: usagerCircuitsRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;

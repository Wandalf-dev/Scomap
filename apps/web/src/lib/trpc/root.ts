import { createTRPCRouter, createCallerFactory } from "./init";
import { etablissementsRouter } from "./routers/etablissements";
import { etablissementContactsRouter } from "./routers/etablissement-contacts";
import { usagersRouter } from "./routers/usagers";
import { usagerAddressesRouter } from "./routers/usager-addresses";

export const appRouter = createTRPCRouter({
  etablissements: etablissementsRouter,
  etablissementContacts: etablissementContactsRouter,
  usagers: usagersRouter,
  usagerAddresses: usagerAddressesRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;

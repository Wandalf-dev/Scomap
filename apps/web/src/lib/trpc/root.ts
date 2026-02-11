import { createTRPCRouter, createCallerFactory } from "./init";
import { etablissementsRouter } from "./routers/etablissements";
import { etablissementContactsRouter } from "./routers/etablissement-contacts";

export const appRouter = createTRPCRouter({
  etablissements: etablissementsRouter,
  etablissementContacts: etablissementContactsRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;

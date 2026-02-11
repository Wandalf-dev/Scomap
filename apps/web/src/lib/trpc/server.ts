import "server-only";

import { cache } from "react";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { dehydrate } from "@tanstack/react-query";
import { appRouter, createCaller } from "./root";
import { createTRPCContext } from "./context";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = createCaller(createTRPCContext);

export { dehydrate };

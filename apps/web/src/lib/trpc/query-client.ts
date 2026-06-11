import {
  defaultShouldDehydrateQuery,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";
import { toast } from "sonner";

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      // Without a global handler, a failing query is indistinguishable from an empty
      // state for screens that don't read `error`. We only signal the initial load
      // failure: a failed refetch preserves the already-displayed data.
      onError: (_error, query) => {
        if (typeof window === "undefined") return;
        if (query.state.data !== undefined) return;
        toast.error("Erreur de chargement des données", {
          id: "query-error",
          description: "Vérifiez votre connexion puis réessayez.",
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}

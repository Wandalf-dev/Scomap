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
      // Sans handler global, une query en erreur est indiscernable d'un état vide
      // pour les écrans qui ne lisent pas `error`. On ne signale que l'échec du
      // chargement initial : un refetch raté garde les données déjà affichées.
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

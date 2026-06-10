import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { getValidatedSession } from "@/lib/auth/validated-session";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { UsersCard } from "@/components/utilisateurs/users-card";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UtilisateursPage() {
  // Page réservée aux administrateurs (rôle relu frais en DB)
  const session = await getValidatedSession();
  if (session?.user?.role !== "admin") {
    redirect("/dashboard");
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.users.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Gérez les comptes ayant accès à votre espace
          </p>
        </div>

        <UsersCard currentUserId={session.user.id} />
      </div>
    </HydrationBoundary>
  );
}

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getTenantSlug } from "@/lib/tenant";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  // Même contrôle que le contexte tRPC : une session d'un autre sous-domaine
  // (ou un ancien JWT sans tenantSlug) est purgée au lieu de laisser les
  // pages crasher en UNAUTHORIZED au prefetch.
  const hostSlug = await getTenantSlug();
  if (!session.user.tenantSlug || session.user.tenantSlug !== hostSlug) {
    redirect("/auth/reset");
  }

  const user = {
    name: session.user?.name || "Utilisateur",
    email: session.user?.email || "",
  };

  return (
    <SidebarConfigProvider>
      <DashboardShell
        user={user}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        {children}
      </DashboardShell>
    </SidebarConfigProvider>
  );
}

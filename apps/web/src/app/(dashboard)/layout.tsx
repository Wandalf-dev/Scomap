import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getValidatedSession } from "@/lib/auth/validated-session";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Même validation que le contexte tRPC : une session d'un autre
  // sous-domaine, un ancien JWT sans tenantSlug ou un compte supprimé est
  // purgé au lieu de laisser les pages crasher en UNAUTHORIZED au prefetch.
  const session = await getValidatedSession();

  if (!session) {
    const raw = await auth();
    redirect(raw ? "/auth/reset" : "/");
  }

  const user = {
    name: session.user?.name || "Utilisateur",
    email: session.user?.email || "",
  };

  return (
    <SidebarConfigProvider>
      <DashboardShell
        user={user}
        isAdmin={session.user.role === "admin"}
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

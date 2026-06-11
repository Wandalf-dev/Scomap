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
  // Same validation as the tRPC context: a session from another subdomain,
  // a legacy JWT without tenantSlug, or a deleted account is purged instead
  // of letting pages crash with UNAUTHORIZED on prefetch.
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

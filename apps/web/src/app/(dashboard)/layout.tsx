import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
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

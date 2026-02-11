"use client";

import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  School,
  Users,
  Route,
  Map,
  Calendar,
  Truck,
  UserCog,
  Receipt,
} from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navGroups: [
    {
      label: "Navigation",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Établissements", url: "/etablissements", icon: School },
        { title: "Usagers", url: "/usagers", icon: Users },
        { title: "Circuits", url: "/circuits", icon: Route },
        { title: "Trajets", url: "/trajets", icon: Map },
        { title: "Planning", url: "/planning", icon: Calendar },
      ],
    },
    {
      label: "Gestion",
      items: [
        { title: "Véhicules", url: "/vehicules", icon: Truck },
        { title: "Chauffeurs", url: "/chauffeurs", icon: UserCog },
        { title: "Facturation", url: "/facturation", icon: Receipt },
      ],
    },
  ],
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string;
    email: string;
  };
  signOutAction: () => void;
}

export function AppSidebar({ user, signOutAction, ...props }: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <Image
                  src="/images/bus-logo.png"
                  alt="Scomap"
                  width={32}
                  height={32}
                  className="rounded-lg invert sepia-[0.3] brightness-[0.7] dark:invert-0 dark:sepia-0 dark:brightness-100"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Scomap</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Transport Scolaire
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain
            key={group.label}
            label={group.label}
            items={group.items}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} signOutAction={signOutAction} />
      </SidebarFooter>
    </Sidebar>
  );
}

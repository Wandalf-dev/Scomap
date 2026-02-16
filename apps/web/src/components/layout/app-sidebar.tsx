"use client";

import Image from "next/image";
import Link from "next/link";
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

import { RectangleGroupIcon } from "@/components/ui/rectangle-group-icon";
import { BuildingOffice2Icon } from "@/components/ui/building-office2-icon";
import { UsersIcon } from "@/components/ui/users-icon";
import { ShareIcon } from "@/components/ui/share-icon";
import { ArrowPathRoundedSquareIcon } from "@/components/ui/arrow-path-rounded-square-icon";
import { CalendarCogIcon } from "@/components/ui/calendar-cog-icon";
import { TruckIcon } from "@/components/ui/truck-icon";
import { UserIcon } from "@/components/ui/user-icon";
import { DocumentCurrencyEuroIcon } from "@/components/ui/document-currency-euro-icon";
import { Cog6ToothIcon } from "@/components/ui/cog6-tooth-icon";

const data = {
  navGroups: [
    {
      label: "Navigation",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: RectangleGroupIcon },
        { title: "Établissements", url: "/etablissements", icon: BuildingOffice2Icon },
        { title: "Usagers", url: "/usagers", icon: UsersIcon },
        { title: "Circuits", url: "/circuits", icon: ShareIcon },
        { title: "Trajets", url: "/trajets", icon: ArrowPathRoundedSquareIcon },
        { title: "Planning", url: "/planning", icon: CalendarCogIcon },
      ],
    },
    {
      label: "Gestion",
      items: [
        { title: "Véhicules", url: "/vehicules", icon: TruckIcon },
        { title: "Chauffeurs", url: "/chauffeurs", icon: UserIcon },
        { title: "Facturation", url: "/facturation", icon: DocumentCurrencyEuroIcon },
      ],
    },
    {
      label: "Configuration",
      items: [
        { title: "Paramètres", url: "/parametres", icon: Cog6ToothIcon },
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
                  className="rounded-lg invert-0 brightness-100"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Scomap</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
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

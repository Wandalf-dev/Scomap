"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Établissements", href: "/etablissements", icon: School },
  { name: "Usagers", href: "/usagers", icon: Users },
  { name: "Circuits", href: "/circuits", icon: Route },
  { name: "Trajets", href: "/trajets", icon: Map },
  { name: "Planning", href: "/planning", icon: Calendar },
  { name: "Véhicules", href: "/vehicules", icon: Truck },
  { name: "Chauffeurs", href: "/chauffeurs", icon: UserCog },
  { name: "Facturation", href: "/facturation", icon: Receipt },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/images/bus-logo.png"
            alt="Scomap"
            width={32}
            height={32}
          />
          <span className="text-lg font-semibold text-sidebar-foreground">
            Scomap
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[0.3rem] px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

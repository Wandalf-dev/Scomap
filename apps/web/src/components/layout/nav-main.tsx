"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export function NavMain({
  label,
  items,
}: {
  label: string;
  items: {
    title: string;
    url: string;
    icon?: React.ElementType;
  }[];
}) {
  const pathname = usePathname();
  const iconRefs = useRef<Record<string, AnimatedIconHandle | null>>({});

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              className="cursor-pointer"
              isActive={pathname.startsWith(item.url)}
            >
              <Link
                href={item.url}
                onMouseEnter={() => iconRefs.current[item.title]?.startAnimation()}
                onMouseLeave={() => iconRefs.current[item.title]?.stopAnimation()}
              >
                {item.icon && (
                  <item.icon
                    size={16}
                    ref={(el: AnimatedIconHandle | null) => {
                      iconRefs.current[item.title] = el;
                    }}
                  />
                )}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
            <SidebarMenuAction
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.url, "_blank", "noopener,noreferrer");
              }}
              title="Ouvrir dans un nouvel onglet"
              className="cursor-pointer"
            >
              <ExternalLink className="size-4" />
              <span className="sr-only">Ouvrir dans un nouvel onglet</span>
            </SidebarMenuAction>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

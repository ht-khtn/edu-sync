"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  DoorOpen,
  BookOpen,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { getPrefetchConfig } from "@/lib/link-optimizer";

import type { LucideIcon } from "lucide-react";

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

const navItems: ReadonlyArray<NavItem> = [
  {
    title: "Bảng điều khiển",
    href: "/olympia/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Giải & trận",
    href: "/olympia/admin/matches",
    icon: Trophy,
  },
  {
    title: "Phòng thi",
    href: "/olympia/admin/rooms",
    icon: DoorOpen,
  },
  {
    title: "Bộ đề",
    href: "/olympia/admin/question-bank",
    icon: BookOpen,
  },
  {
    title: "Tài khoản",
    href: "/olympia/admin/accounts",
    icon: Users,
  },
] as const;

function OlympiaAdminSidebarComponent() {
  const pathname = usePathname();

  const renderNavItems = (items: ReadonlyArray<NavItem>) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const config = getPrefetchConfig(item.href);
        const shouldPrefetch = config.prefetch !== false;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Link href={item.href} prefetch={shouldPrefetch}>
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar
      className="border-r border-sidebar-border bg-sidebar"
      suppressHydrationWarning
    >
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div
          className="flex items-center gap-2 px-4 py-4"
          suppressHydrationWarning
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg font-bold">O</span>
          </div>
          <Link
            href="/olympia/admin"
            className="text-lg font-semibold tracking-tight text-sidebar-foreground hover:text-primary transition-colors"
          >
            Olympia Admin
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Điều hướng
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavItems(navItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar">
        <div className="p-4 text-xs text-muted-foreground">EduSync Olympia</div>
      </SidebarFooter>
    </Sidebar>
  );
}

export const OlympiaAdminSidebar = React.memo(OlympiaAdminSidebarComponent);
